import assert from 'node:assert/strict';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createMote, normalizeConfig } from '../mote.js';
import { createTestHost } from './support/host.mjs';

test('legacy configuration becomes a mote channel and public state omits secrets', () => {
  const normalized = normalizeConfig({
    baseUrl: 'https://upstream.test/', apiKey: 'test-only-key', pollIntervalMs: 1,
  });
  assert.equal(normalized.channels[0].id, 'mote');
  assert.equal(normalized.channels[0].baseUrl, 'https://upstream.test');
  assert.equal(normalized.pollIntervalMs, 500);
  const mote = createMote(normalized);
  assert.equal(mote.status().configured, true);
  assert.equal(mote.channels()[0].configured, true);
  assert.equal(JSON.stringify(mote.status()).includes('test-only-key'), false);
  assert.equal('apiKey' in mote.channels()[0], false);
});

test('Host registers its existing tools, routes and cleans them up', async (t) => {
  const host = await createTestHost(t, {}, { delayedConnection: true });
  assert.deepEqual([...host.tools.keys()], ['mote_models', 'mote_image', 'mote_video', 'mote_media_task']);
  assert.equal(host.routes.size, 0);
  host.connect();
  host.connect();
  assert.deepEqual([...host.routes.keys()], ['/api/mote-media/asset', '/api/mote-media']);
  assert.deepEqual(host.routes.get('/api/mote-media').methods, ['GET', 'POST']);
  const { data } = await host.call('state');
  assert.equal(data.route.registered, true);
  assert.equal(data.route.connection, true);
  host.dispose();
  assert.equal(host.routes.size, 0);
  assert.equal(host.tools.size, 0);
});

test('channel edits preserve a blank key and persist only inside the test package', async (t) => {
  const host = await createTestHost(t, {
    channels: [{ id: 'images', driver: 'openai-images', baseUrl: 'https://upstream.test', apiKey: 'test-only-key', models: ['test-image'] }],
  });
  const before = await host.call('state');
  assert.equal(JSON.stringify(before.data).includes('test-only-key'), false);
  const result = await host.call('config', { patch: {
    channels: [{ id: 'images', name: 'Renamed', driver: 'openai-images', baseUrl: 'https://upstream.test', apiKey: '', models: ['test-image'] }],
  } });
  assert.equal(result.data.ok, true);
  assert.equal(result.data.channels[0].configured, true);
  assert.equal(JSON.stringify(result.data).includes('test-only-key'), false);
  const overlay = JSON.parse(await readFile(join(host.root, '.mote-state.json'), 'utf8'));
  assert.equal(overlay.channels[0].apiKey, 'test-only-key');
  assert.equal(overlay.channels[0].name, 'Renamed');
  const routeModels = await host.call('models');
  const toolModels = await host.tools.get('mote_models').execute({});
  assert.deepEqual(routeModels.data.models, toolModels.models);
});

test('asset route serves output files and rejects paths outside the output directory', async (t) => {
  const host = await createTestHost(t);
  await mkdir(join(host.root, 'output'));
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  await writeFile(join(host.root, 'output', 'image.png'), image);
  await writeFile(join(host.root, 'outside.png'), 'private test file');
  const route = host.routes.get('/api/mote-media/asset');
  const served = await route.fetch(new Request('http://host.test/api/mote-media/asset?path=image.png'));
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), image);
  const response = await route.fetch(new Request('http://host.test/api/mote-media/asset?path=../outside.png'));
  assert.equal(response.status, 403);
  await access(join(host.root, 'outside.png'));
  const publicProxy = await route.fetch(new Request('http://host.test/api/mote-media/asset?url=https://example.test/image.png'));
  assert.equal(publicProxy.status, 403);
});

test('configuration overlay stays at the package root and survives a Host reload', async (t) => {
  const host = await createTestHost(t);
  const saved = await host.call('config', { patch: { imageModel: 'persisted-image', pollIntervalMs: 1500 } });
  assert.equal(saved.data.ok, true);
  const probe = await host.call('selftest');
  assert.equal(probe.data.overlayPath, join(host.root, '.mote-state.json'));
  host.restart();
  const restored = await host.call('state');
  assert.equal(restored.data.imageModel, 'persisted-image');
  assert.equal(restored.data.pollIntervalMs, 1500);
});

test('successful profile mirroring preserves blank keys and removes the stale overlay', async (t) => {
  const entry = { options: { name: '@local/dsh-mote-media' } };
  let profile = { retainedSetting: 'keep' };
  const editor = {
    entries: () => [entry],
    async edit(target, update) { assert.equal(target, entry); profile = update(profile); },
  };
  const host = await createTestHost(t, {}, { services: { configEditor: editor }, overlay: {
    channels: [{ id: 'images', driver: 'openai-images', baseUrl: 'https://fake-upstream.test', apiKey: 'fake-existing-key', models: ['test-image'] }],
    imageModel: 'old-image',
  } });
  const saved = await host.call('config', { patch: {
    channels: [{ id: 'images', driver: 'openai-images', baseUrl: 'https://fake-upstream.test', apiKey: '', models: ['test-image'] }], imageModel: 'new-image',
  } });
  assert.equal(saved.data.mirrored, true);
  assert.equal(profile.channels[0].apiKey, 'fake-existing-key');
  assert.equal(profile.imageModel, 'new-image');
  assert.equal(profile.retainedSetting, 'keep');
  assert.equal(JSON.stringify(saved.data).includes('fake-existing-key'), false);
  await assert.rejects(access(join(host.root, '.mote-state.json')), { code: 'ENOENT' });
});

test('profile write failure falls back to the package overlay without losing the existing key', async (t) => {
  const host = await createTestHost(t, {
    channels: [{ id: 'test', baseUrl: 'https://fake-upstream.test', apiKey: 'fake-existing-key' }],
  }, { services: { configEditor: {
    entries: () => [{ name: '@local/dsh-mote-media' }], edit: async () => { throw new Error('test write failure'); },
  } } });
  const saved = await host.call('config', { patch: {
    channels: [{ id: 'test', name: 'Renamed', baseUrl: 'https://fake-upstream.test', apiKey: '' }],
  } });
  assert.equal(saved.data.ok, true);
  assert.equal(saved.data.mirrored, false);
  host.restart();
  const restored = await host.call('state');
  assert.equal(restored.data.channels[0].name, 'Renamed');
  assert.equal(restored.data.channels[0].configured, true);
  assert.equal(JSON.stringify(restored.data).includes('fake-existing-key'), false);
});

test('configuration validation and write failures preserve their existing HTTP contracts', async (t) => {
  const host = await createTestHost(t);
  for (const patch of [null, {}]) {
    const result = await host.call('config', { patch });
    assert.equal(result.response.status, 400);
    assert.equal(result.data.ok, false);
  }
  const route = host.routes.get('/api/mote-media');
  const malformed = await route.fetch(new Request('http://host.test/api/mote-media', { method: 'POST', body: 'invalid JSON' }));
  assert.equal(malformed.status, 400);
  await mkdir(join(host.root, '.mote-state.json'));
  const failed = await host.call('config', { patch: { imageModel: 'new-image' } });
  assert.equal(failed.response.status, 200);
  assert.equal(failed.data.ok, false);
  assert.ok(failed.data.error.message.startsWith(`cannot write ${join(host.root, '.mote-state.json')}:`));
});
