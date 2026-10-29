import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createMote } from '../mote.js';
import { createFakeUpstream as upstream } from './support/upstream.mjs';

test('the shared image dispatcher rejects provider group counts before any network request', async t => {
  const fake = await upstream(t, () => ({ data: {} }));
  const mote = createMote({ channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  let dispatched = false;
  await assert.rejects(mote.generateImage({ prompt: 'test', n: 2, onDispatch: () => { dispatched = true; } }), { code: 'single_image_required' });
  assert.equal(dispatched, false);
  assert.equal(fake.requests.length, 0);
});

test('catalog routing, mote image/video submission, polling and download use one shared client', async (t) => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  let polls = 0;
  let baseUrl;
  const fake = await upstream(t, ({ path, body }) => {
    if (path === '/media/v1/models') return { data: { data: [
      { id: 'test-image', type: 'image', parameters: { n: { minimum: 1, maximum: 4 } } },
      { id: 'test-video', type: 'video', supports_cancel: true },
    ] } };
    if (path === '/media/v1/images/generations') return { data: {
      id: 'image-task', type: 'image', model: body.model, status: 'succeeded', artifacts: [
        { index: 0, kind: 'image', state: 'available', mime_type: 'image/png', url: `${baseUrl}/artifact.png` },
      ],
    } };
    if (path === '/media/v1/videos/generations') return { data: { id: 'video-task', type: 'video', status: 'queued' } };
    if (path === '/media/v1/tasks/video-task') {
      polls += 1;
      return { data: { id: 'video-task', type: 'video', status: polls < 2 ? 'running' : 'succeeded' } };
    }
    if (path === '/artifact.png') return { bytes: image };
    return { status: 404, data: { error: { message: 'unexpected fake request' } } };
  });
  baseUrl = fake.baseUrl;
  const mote = createMote({ channels: [
    { id: 'mote', baseUrl, apiKey: 'fake-mote-key' },
    { id: 'openai', driver: 'openai-images', baseUrl: `${baseUrl}/openai`, apiKey: 'fake-openai-key', models: ['other-image'] },
  ], outputDir: fake.outputDir, pollIntervalMs: 500 });
  const models = await mote.listModels();
  assert.deepEqual(models.map(({ id, channelId }) => [id, channelId]), [
    ['test-image', 'mote'], ['test-video', 'mote'], ['other-image', 'openai'],
  ]);
  const refs = [{ role: 'reference', type: 'image', file_id: 'fake-reference' }];
  const task = await mote.generateImage({ model: 'test-image', prompt: 'test prompt', references: refs });
  const submitted = fake.requests.find(({ path }) => path === '/media/v1/images/generations');
  assert.equal(submitted.headers.authorization, 'Bearer fake-mote-key');
  assert.ok(submitted.headers['idempotency-key']);
  assert.equal(submitted.body.n, 1);
  assert.deepEqual(submitted.body.references, refs);
  const saved = await mote.saveArtifacts(task);
  assert.equal(saved.saved.length, 1);
  assert.deepEqual(await readFile(saved.saved[0].path), image);
  const video = await mote.generateVideo({ model: 'test-video', prompt: 'test motion', duration: 5, waitSeconds: 0 });
  assert.equal(video.status, 'queued');
  const finished = await mote.settle(video, 3);
  assert.equal(finished.status, 'succeeded');
  assert.equal(polls, 2);
  assert.equal(fake.requests.filter(({ path }) => path === '/media/v1/models').length, 1, 'catalog is cached on the shared instance');
});

test('OpenAI-compatible routing writes Base64 artifacts locally and retrieves the local task', async (t) => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 5, 6]);
  const fake = await upstream(t, ({ path }) => path === '/v1/images/generations'
    ? { data: { data: [{ b64_json: image.toString('base64') }] } }
    : { status: 404, data: {} });
  const mote = createMote({ channels: [{
    id: 'openai', driver: 'openai-images', baseUrl: `${fake.baseUrl}/v1`, apiKey: 'fake-openai-key', models: ['test-image'],
  }], outputDir: fake.outputDir });
  const task = await mote.generateImage({ model: 'test-image', prompt: 'test', size: '1024x1024', n: 1 });
  assert.equal(task.status, 'succeeded');
  assert.equal(fake.requests.length, 1);
  assert.equal(fake.requests[0].headers.authorization, 'Bearer fake-openai-key');
  assert.deepEqual(fake.requests[0].body, { model: 'test-image', prompt: 'test', n: 1, size: '1024x1024' });
  assert.deepEqual(await readFile(task.artifacts[0].local_path), image);
  assert.ok(task.artifacts[0].url.startsWith('/api/mote-media/asset?path='));
  assert.equal(await mote.getTask(task.id), task);
  const saved = await mote.saveArtifacts(task);
  assert.deepEqual(await readFile(saved.saved[0].path), image);
});

test('downloads select the requested artifact and return partial failures instead of false success', async (t) => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const fake = await upstream(t, ({ path }) => path === '/one.png' ? { bytes } : { status: 403, data: {} });
  const mote = createMote({ outputDir: fake.outputDir });
  const task = { id: 'multi', artifacts: ['one', 'two'].map((name, index) => ({ index, kind: 'image', state: 'available', mime_type: 'image/png', url: `${fake.baseUrl}/${name}.png` })) };
  const partial = await mote.saveArtifacts(task);
  assert.equal(partial.saved.length, 2);
  assert.equal(partial.saved[0].error, undefined);
  assert.match(partial.saved[1].error, /HTTP 403/);
  const selected = await mote.saveArtifacts(task, { artifactIndex: 0 });
  assert.equal(selected.saved.length, 1);
  assert.deepEqual(await readFile(selected.saved[0].path), bytes);
});

test('local copy and file write failures are reported using the actual destination', async (t) => {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const fake = await upstream(t, () => ({ bytes }));
  const source = join(fake.outputDir, 'source');
  const output = join(fake.outputDir, 'output');
  await mkdir(source); await mkdir(output);
  await writeFile(join(source, 'copy-0.png'), bytes);
  const mote = createMote({ outputDir: output });
  const copied = await mote.saveArtifacts({ id: 'copy', artifacts: [{ index: 0, state: 'available', kind: 'image', mime_type: 'image/png', local_path: join(source, 'copy-0.png') }] });
  assert.equal(copied.saved[0].path, join(output, 'copy-0.png'));
  assert.deepEqual(await readFile(copied.saved[0].path), bytes);
  const missing = await mote.saveArtifacts({ id: 'missing', artifacts: [{ index: 0, state: 'available', kind: 'image', mime_type: 'image/png', local_path: join(output, 'missing-0.png') }] });
  assert.ok(missing.saved[0].error);
  await mkdir(join(output, 'blocked-0.png'));
  const blocked = await mote.saveArtifacts({ id: 'blocked', artifacts: [{ index: 0, state: 'available', kind: 'image', mime_type: 'image/png', url: `${fake.baseUrl}/image.png` }] });
  assert.ok(blocked.saved[0].error);
});
