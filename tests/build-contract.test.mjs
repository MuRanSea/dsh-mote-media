import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('build check rejects missing and stale output, then accepts a reproducible bundle', async (t) => {
  // Keep this fixture under the project so it can resolve the locked build
  // dependency without installing packages or linking into node_modules.
  const root = await mkdtemp(fileURLToPath(new URL('../.build-check-', import.meta.url)));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['scripts', 'src/client']) await mkdir(join(root, directory), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
  await copyFile(new URL('../scripts/build-client.mjs', import.meta.url), join(root, 'scripts/build-client.mjs'));
  await cp(new URL('../src/client/', import.meta.url), join(root, 'src/client'), { recursive: true });
  const run = (...args) => spawnSync(process.execPath, ['scripts/build-client.mjs', ...args], { cwd: root, encoding: 'utf8' });
  const missing = run('--check');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /missing or out of date/);
  assert.equal(run().status, 0);
  const first = await readFile(join(root, 'client.js'), 'utf8');
  assert.equal(run('--check').status, 0);
  assert.equal(run().status, 0);
  assert.equal(await readFile(join(root, 'client.js'), 'utf8'), first);
  const entry = join(root, 'src/client/entry.js');
  await writeFile(entry, (await readFile(entry, 'utf8')).replace('@local/dsh-mote-media', '@local/test-mote-media'));
  const stale = run('--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /missing or out of date/);
});
