import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { checkClient } from './build-client.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this check with npm run check:package.');
await checkClient();
const temporary = await mkdtemp(join(tmpdir(), 'mote-package-check-'));
try {
  // Create a real archive without lifecycle hooks or registry requests.
  const packed = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack',
    '--json', '--ignore-scripts', '--offline', '--pack-destination', temporary,
    '--cache', join(temporary, 'npm-cache'),
  ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  assert.equal(packed.length, 1);
  const expected = ['LICENSE', 'README.md', 'client.js', 'cordis.patch.yml', 'icon.svg', 'index.js', 'locale/en.json', 'locale/zh.json', 'mote.js', 'package.json'];
  expected.push(...[
    'channels/mote.js', 'channels/openai-images.js', 'channels/registry.js', 'channels/request.js',
    'config/normalize.js', 'config/store.js',
    'media/artifacts.js', 'media/catalog.js', 'media/references.js', 'media/service.js', 'media/task-view.js', 'media/tasks.js', 'media/submissions.js',
    'routes/api.js', 'routes/assets.js', 'routes/register.js', 'tools/register.js', 'tools/image-workflow.js',
    'skills/register.js',
  ].map((path) => `src/host/${path}`));
  expected.push('skills/mote-image/SKILL.md');
  assert.deepEqual(packed[0].files.map(({ path }) => path).sort(), expected.sort(), 'package must contain only the runtime files');
  const unpacked = join(temporary, 'unpacked');
  await mkdir(unpacked);
  execFileSync('tar', ['-xf', join(temporary, packed[0].filename), '-C', unpacked], { stdio: 'pipe' });
  const packageRoot = join(unpacked, 'package');
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.exports['.'], './index.js');
  assert.equal(manifest.exports['./client'], './client.js');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.dsh.client.immediately, true);
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0, 'runtime must not need npm dependencies');
  let loaded;
  vm.runInNewContext(await readFile(join(packageRoot, 'client.js'), 'utf8'), {
    window: { __ModuleLoader__: { load: (definition) => { loaded = definition; } } },
  }, { filename: 'packed-client.js' });
  assert.equal(loaded.id, '@local/dsh-mote-media');
  const plugin = loaded.factory((name) => {
    assert.equal(name, 'react');
    return {};
  });
  assert.equal(typeof plugin.apply, 'function');
  const host = await import(pathToFileURL(join(packageRoot, 'index.js')).href);
  assert.equal(typeof host.apply, 'function');
  console.log(`Package verified: ${packed[0].files.length} runtime files; packed Host and DSH client entry points load.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
