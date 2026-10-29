import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as facade from '../mote.js';
import { createTestHost } from './support/host.mjs';
import { createFakeUpstream } from './support/upstream.mjs';

test('the original mote module keeps its public exports and media interface', () => {
  assert.deepEqual(Object.keys(facade).sort(), [
    'ASSET_PATH', 'DEFAULT_OUTPUT_DIR', 'DRIVERS', 'PENDING_STATUSES', 'createMote', 'extensionFor',
    'isNonPublicHost', 'isNonPublicUrl', 'normalizeChannel', 'normalizeConfig', 'sniffMime', 'toReferences',
  ].sort());
  assert.deepEqual(Object.keys(facade.createMote({ apiKey: 'fake-key' })).sort(), [
    'configure', 'status', 'channels', 'channelById', 'listModels', 'discoverModels', 'modelInfo', 'generateImage',
    'generateVideo', 'getTask', 'getTasks', 'cancelTask', 'settle', 'saveArtifacts', 'resolveOutputDir', 'localTask',
  ].sort());
});

test('routes and tools share catalog caching and config edits invalidate that cache', async (t) => {
  const fake = await createFakeUpstream(t, ({ path }) => path === '/media/v1/models'
    ? { data: { data: [{ id: 'test-image', type: 'image' }, { id: 'test-video', type: 'video' }] } }
    : { status: 404, data: {} });
  const host = await createTestHost(t, { channels: [{ id: 'mote', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const viaRoute = await host.call('models');
  const viaTool = await host.tools.get('mote_models').execute({});
  assert.deepEqual(viaRoute.data.models, JSON.parse(JSON.stringify(viaTool.models)));
  assert.equal(fake.requests.length, 1);
  const changed = await host.call('config', { patch: { imageModel: 'test-image' } });
  assert.equal(changed.data.ok, true);
  await host.tools.get('mote_models').execute({ category: 'image' });
  assert.equal(fake.requests.length, 2);
  assert.equal(fake.requests[1].headers.authorization, 'Bearer fake-key');
});

test('OpenAI route and tool submissions share local tasks, artifact access and downloads', async (t) => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const fake = await createFakeUpstream(t, ({ path }) => path === '/v1/images/generations'
    ? { data: { data: [{ b64_json: image.toString('base64') }] } }
    : { status: 404, data: {} });
  const host = await createTestHost(t, { channels: [{
    id: 'openai', driver: 'openai-images', baseUrl: fake.baseUrl, apiKey: 'fake-key', models: ['test-image'],
  }] });
  await host.call('prepare', { submissionId: 'openai-image', snapshot: { kind: 'image', channelId: 'openai', model: 'test-image', prompt: 'test image', params: {}, references: [] } });
  const generated = await host.call('generate', { submissionId: 'openai-image' });
  assert.equal(generated.data.ok, true);
  const task = generated.data.task;
  const status = await host.tools.get('mote_media_task').execute({ action: 'status', task_id: task.id });
  assert.deepEqual(status.task, task);
  const asset = await host.routes.get('/api/mote-media/asset').fetch(new Request(`http://host.test${task.artifacts[0].url}`));
  assert.equal(asset.status, 200);
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()), image);
  const downloaded = await host.tools.get('mote_media_task').execute({ action: 'download', task_id: task.id });
  assert.deepEqual(await readFile(downloaded.saved[0].path), image);
  const viaTool = await host.tools.get('mote_image').execute({ model: 'test-image', prompt: 'another test image', save: false });
  const viaRoute = await host.call('task', { id: viaTool.task.id });
  assert.deepEqual(viaRoute.data.task, viaTool.task);
  const cancelled = await host.tools.get('mote_media_task').execute({ action: 'cancel', task_id: viaTool.task.id });
  assert.equal(cancelled.error, 'local results cannot be cancelled');
  assert.equal(fake.requests.length, 2, 'local status, asset and download must not query another provider');
});

test('mote reference preparation preserves LAN image inlining, errors and non-image restrictions', async (t) => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 8, 9]);
  const fake = await createFakeUpstream(t, ({ path, body }) => {
    if (path === '/reference.png') return { bytes: image };
    if (path === '/offline.png') return { disconnect: true };
    if (path === '/media/v1/images/generations') return { data: { id: 'image-task', model: body.model, status: 'succeeded' } };
    return { status: 404, data: {} };
  });
  const mote = facade.createMote({ channels: [{ id: 'mote', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const input = { model: 'test-image', prompt: 'test', catalog: [{ id: 'test-image', channelId: 'mote' }], waitSeconds: 0 };
  const task = await mote.generateImage({ ...input, references: [{ role: 'reference', type: 'image', url: `${fake.baseUrl}/reference.png` }] });
  assert.equal(task.inlined, 1);
  assert.equal(fake.requests[1].body.references[0].url, `data:image/png;base64,${image.toString('base64')}`);
  await assert.rejects(mote.generateImage({ ...input, references: [{ type: 'video', url: `${fake.baseUrl}/movie.mp4` }] }), /参考视频必须是公网可访问/);
  await assert.rejects(mote.generateImage({ ...input, references: [{ type: 'image', url: `${fake.baseUrl}/offline.png` }] }), /局域网素材读取失败/);
  assert.equal(fake.requests.filter(({ path }) => path.endsWith('/images/generations')).length, 1);
});

test('ambiguous model ids require a channel and configured defaults retain their channel', async (t) => {
  const fake = await createFakeUpstream(t, () => ({ data: { data: [{ b64_json: 'iVBORw==' }] } }));
  const mote = facade.createMote({ outputDir: fake.outputDir, channels: ['a', 'b'].map((id) => ({
    id, driver: 'openai-images', baseUrl: `${fake.baseUrl}/${id}`, apiKey: 'fake-key', models: ['same-model'],
  })) });
  await assert.rejects(mote.generateImage({ prompt: 'test', model: 'same-model' }), /multiple channels/);
  assert.equal(fake.requests.length, 0);
  mote.configure({ imageModel: 'same-model', imageChannelId: 'b' });
  const task = await mote.generateImage({ prompt: 'test' });
  assert.equal(task.channel_id, 'b');
  assert.equal(fake.requests[0].path, '/b/v1/images/generations');
  await assert.rejects(mote.generateImage({ prompt: 'test', channelId: 'b', references: ['file-id'] }), /does not support image references/);
  assert.equal(fake.requests.length, 1);
});
