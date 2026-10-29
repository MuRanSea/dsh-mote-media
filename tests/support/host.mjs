import { mkdtemp, copyFile, cp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Each host owns a temporary package root, including its configuration overlay.
// Tests never read or replace the real package's stored credentials.
export async function createTestHost(t, config = {}, { delayedConnection = false, overlay, services = {} } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'mote-host-test-'));
  // Windows may briefly retain an empty directory after a receipt rename.
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
  for (const file of ['index.js', 'mote.js']) {
    await copyFile(new URL(`../../${file}`, import.meta.url), join(root, file));
  }
  await cp(new URL('../../src/host/', import.meta.url), join(root, 'src/host'), { recursive: true });
  await cp(new URL('../../skills/', import.meta.url), join(root, 'skills'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
  if (overlay) await writeFile(join(root, '.mote-state.json'), JSON.stringify(overlay));
  const tools = new Map();
  const routes = new Map();
  const cleanups = [];
  let injectConnection;
  let connectionReady = !delayedConnection;
  const connection = {
    fetch: {
      register(route) {
        if (routes.has(route.path)) throw new Error(`duplicate route: ${route.path}`);
        routes.set(route.path, route);
        return () => routes.delete(route.path);
      },
    },
  };
  const ctx = {
    tools: {
      register(tool) {
        tools.set(tool.name, tool);
        return () => tools.delete(tool.name);
      },
    },
    get(name) {
      return name === 'connection' && connectionReady ? connection : services[name];
    },
    effect(effect) {
      const cleanup = effect();
      if (typeof cleanup === 'function') cleanups.push(cleanup);
      return cleanup;
    },
    inject(_names, callback) {
      injectConnection = callback;
    },
  };
  const { apply } = await import(pathToFileURL(join(root, 'index.js')).href);
  const rawConfig = { apiKey: 'test-only-key', ...config, outputDir: join(root, 'output') };
  apply(ctx, rawConfig);
  const dispose = () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
  t.after(dispose);
  return {
    root, tools, routes, dispose,
    restart() {
      dispose();
      apply(ctx, rawConfig);
    },
    connect() {
      connectionReady = true;
      injectConnection(ctx);
    },
    async call(action, payload = {}) {
      const route = routes.get('/api/mote-media');
      const response = await route.fetch(new Request('http://host.test/api/mote-media', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      }));
      return { response, data: await response.json() };
    },
  };
}
