import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function createFakeUpstream(t, handler) {
  const requests = [];
  const server = createServer(async (req, res) => {
    try {
      let text = '';
      for await (const chunk of req) text += chunk;
      const request = { path: req.url, method: req.method, headers: req.headers, body: text ? JSON.parse(text) : undefined };
      requests.push(request);
      const result = await handler(request);
      if (result.disconnect) { req.socket.destroy(); return; }
      res.writeHead(result.status ?? 200, { 'content-type': result.bytes ? 'image/png' : 'application/json' });
      res.end(result.bytes ?? JSON.stringify(result.data));
    } catch {
      res.writeHead(500);
      res.end('{}');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const nativeFetch = globalThis.fetch;
  t.mock.method(globalThis, 'fetch', (input, options) => {
    assert.ok(String(input).startsWith(`${baseUrl}/`), 'tests may only call their loopback fake upstream');
    return nativeFetch(input, options);
  });
  const outputDir = await mkdtemp(join(tmpdir(), 'mote-flow-test-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  return { baseUrl, outputDir, requests };
}
