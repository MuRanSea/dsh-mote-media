import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createMote } from '../mote.js';
import { createSubmissionStore } from '../src/host/media/submissions.js';
import { createImageWorkflow } from '../src/host/tools/image-workflow.js';
import { createTestHost } from './support/host.mjs';
import { createFakeUpstream } from './support/upstream.mjs';

const model = { id: 'image-model', type: 'image', parameters: {
  resolution: { enum: ['1K', '2K'], default: '2K' },
  aspect_ratio: { enum: ['1:1', '9:16'], default: '1:1' },
  n: { type: 'integer', minimum: 1, maximum: 2, default: 1 },
}, references: [{ role: 'reference', types: ['image'], max_count: 1 }] };
const context = { callId: 'call-1', agent: { id: 'conversation-1' } };

test('a batch preparation failure dispatches nothing and resuming missing children keeps the original model and channel', async t => {
  const fake = await createFakeUpstream(t, ({ path, body }) => {
    if (path.endsWith('/models')) return { data: { data: [model] } };
    return { data: { id: `task-${body.prompt}-${fake.requests.length}`, model: body.model, type: 'image', status: 'queued' } };
  });
  const mote = createMote({ imageModel: model.id, imageChannelId: 'original', channels: [{ id: 'original', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const directory = join(fake.outputDir, 'receipts');
  const submissions = createSubmissionStore(directory, mote);
  const prepare = submissions.prepare;
  let preparations = 0;
  submissions.prepare = (...args) => {
    if (++preparations === 3) throw new Error('simulated storage failure');
    return prepare(...args);
  };
  const args = { prompt: 'captured', n: 3, save: false };
  const interrupted = await createImageWorkflow(mote, submissions).generate(args, context);
  assert.equal(interrupted.results.length, 2);
  assert.ok(interrupted.results.every(row => row.state === 'prepared'));
  assert.match(interrupted.error, /storage failure/);
  assert.equal(fake.requests.filter(row => row.path.endsWith('/images/generations')).length, 0);
  mote.configure({ imageModel: 'new-default', imageChannelId: 'missing' });
  const resumed = await createImageWorkflow(mote, createSubmissionStore(directory, mote)).generate(args, context);
  assert.equal(resumed.results.length, 3);
  assert.ok(resumed.results.every(row => row.channelId === 'original' && row.task.model === model.id));
  const posts = fake.requests.filter(row => row.path.endsWith('/images/generations'));
  assert.equal(posts.length, 3);
  assert.ok(posts.every(row => row.body.n === 1 && row.body.prompt === 'captured'));
});

test('concurrent calls with different independent counts cannot reuse the same tool invocation', async t => {
  const fake = await createFakeUpstream(t, ({ path, body }) => path.endsWith('/models')
    ? { data: { data: [model] } } : { data: { id: `task-${fake.requests.length}`, model: body.model, type: 'image', status: 'queued' } });
  const host = await createTestHost(t, { channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const results = await Promise.all([2, 3].map(n => host.tools.get('mote_image').execute({ prompt: 'same prompt', n, save: false }, context)));
  assert.equal(results.filter(row => row.code === 'submission_conflict').length, 1);
  const winner = results.find(row => row.results);
  assert.equal(fake.requests.filter(row => row.path.endsWith('/images/generations')).length, winner.results.length);
});

test('chat n creates durable independent tasks on a single-image model and replays each outcome without resubmission', async t => {
  const single = { ...model, parameters: { ...model.parameters, n: { type: 'integer', minimum: 1, maximum: 1, default: 1 } } };
  let host;
  let posted = 0;
  const durableCounts = [];
  const fake = await createFakeUpstream(t, async ({ path, body }) => {
    if (path.endsWith('/models')) return { data: { data: [single] } };
    if (path.endsWith('/images/generations')) {
      durableCounts.push((await host.call('chat_works')).data.submissions.length);
      posted += 1;
      if (posted === 2) return { status: 500, data: { error: { message: 'acceptance unknown' } } };
      if (posted === 3) return { status: 400, data: { error: { message: 'rejected image' } } };
      return { data: { id: 'independent-chat', type: 'image', model: body.model, status: 'succeeded', artifacts: [] } };
    }
    return { status: 404, data: {} };
  });
  host = await createTestHost(t, { imageModel: single.id, imageChannelId: 'test',
    channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const args = { prompt: 'three independent images', n: 3, wait_seconds: 50, save: false };
  const [first, concurrent] = await Promise.all([host.tools.get('mote_image').execute(args, context), host.tools.get('mote_image').execute(args, context)]);
  assert.equal(first.results.length, 3);
  assert.deepEqual(first.results, concurrent.results);
  assert.deepEqual(first.results.map(row => row.state), ['accepted', 'unknown', 'failed']);
  assert.equal(new Set(first.results.map(row => row.submissionId)).size, 3);
  assert.deepEqual(durableCounts, [3, 3, 3], 'every child receipt exists before any paid dispatch');
  const posts = fake.requests.filter(row => row.path.endsWith('/images/generations'));
  assert.equal(posts.length, 3);
  assert.ok(posts.every(row => row.body.n === 1 && row.body.wait === 0 && row.body.prompt === args.prompt));
  assert.equal(new Set(posts.map(row => row.headers['idempotency-key'])).size, 3);
  const tool = host.tools.get('mote_image');
  assert.deepEqual(JSON.parse(tool.output.render(args, first)[0].text), first);
  assert.equal(tool.output.presentationMeta(args, first).moteMedia.results.length, 3);
  await host.call('config', { patch: { imageModel: 'new-default', imageChannelId: 'missing' } });
  host.restart();
  const replay = await host.tools.get('mote_image').execute(args, context);
  assert.deepEqual(replay.results, first.results);
  for (const row of replay.results) {
    const recovered = await host.tools.get('mote_media_task').execute({ action: 'status', submission_id: row.submissionId });
    assert.equal(recovered.state, row.state);
    assert.equal(recovered.creation.params.n, 1);
    assert.equal(recovered.channelId, 'test');
  }
  const conflict = await host.tools.get('mote_image').execute({ ...args, n: 4 }, context);
  assert.equal(conflict.code, 'submission_conflict');
  assert.equal(fake.requests.filter(row => row.path.endsWith('/images/generations')).length, 3);
});

test('chat independent image count also dispatches separate OpenAI-compatible single-image requests', async t => {
  const fake = await createFakeUpstream(t, ({ path }) => path.endsWith('/images/generations')
    ? { data: { data: [{ b64_json: 'iVBORw==' }] } } : { status: 404, data: {} });
  const host = await createTestHost(t, { imageModel: 'single-image', imageChannelId: 'test', channels: [{
    id: 'test', driver: 'openai-images', baseUrl: fake.baseUrl, apiKey: 'fake-key', models: ['single-image'],
  }] });
  const args = { prompt: 'independent compatible images', n: 2, save: false };
  const first = await host.tools.get('mote_image').execute(args, context);
  assert.equal(first.results.length, 2);
  assert.equal(new Set(first.results.map(row => row.task.id)).size, 2);
  assert.ok(first.results.every(row => row.task.status === 'succeeded' && row.task.artifacts.length === 1));
  assert.ok(fake.requests.every(row => row.body.n === 1));
  host.restart();
  const replay = await host.tools.get('mote_image').execute(args, context);
  assert.deepEqual(replay.results, first.results);
  assert.equal(fake.requests.length, 2);
});

test('chat image creation preserves its prompt/settings and replays one durable generation with local presentation', async (t) => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]);
  const fake = await createFakeUpstream(t, ({ path, body }) => {
    if (path.endsWith('/models')) return { data: { data: [model] } };
    if (path.endsWith('/images/generations')) return { data: {
      id: 'chat-image', type: 'image', model: body.model, status: 'succeeded',
      artifacts: [{ index: 3, kind: 'image', state: 'available', mime_type: 'image/png', url: `${fake.baseUrl}/result.png` }],
    } };
    if (path === '/result.png') return { bytes: image };
    return { status: 404, data: {} };
  });
  const host = await createTestHost(t, { imageModel: model.id, imageChannelId: 'test', channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const catalog = await host.tools.get('mote_models').execute({ category: 'image' });
  assert.deepEqual(catalog.defaults.image, { model: model.id, channel: 'test' });
  const args = { prompt: '雨夜城市，主体位于下方，顶部留白。文字逐字为“晚安”。', original_prompt: '手机壁纸，写“晚安”', resolution: '2K', aspect_ratio: '9:16', watermark: false, wait_seconds: 0 };
  const [a, b] = await Promise.all([host.tools.get('mote_image').execute(args, context), host.tools.get('mote_image').execute(args, context)]);
  assert.ok(a.submissionId);
  assert.equal(a.submissionId, b.submissionId);
  assert.equal(a.task.status, 'succeeded');
  assert.equal(a.creation.originalPrompt, args.original_prompt);
  assert.equal(a.creation.prompt, args.prompt);
  assert.equal(a.creation.params.aspect_ratio, '9:16');
  assert.deepEqual(await readFile(a.saved[0].path), image);
  const meta = host.tools.get('mote_image').output.presentationMeta(args, a).moteMedia;
  assert.equal(meta.version, 1);
  assert.equal(meta.images[0].url.startsWith('/api/mote-media/asset?path='), true);
  assert.equal(meta.images[0].artifactIndex, 0, 'UI position differs from the provider artifact index');
  host.restart();
  const replay = await host.tools.get('mote_image').execute(args, context);
  assert.equal(replay.submissionId, a.submissionId);
  assert.equal(replay.task.id, a.task.id);
  const snapshot = (await host.call('submission', { submissionId: a.submissionId, includeSnapshot: true })).data.submission.snapshot;
  assert.equal(snapshot.originalPrompt, args.original_prompt);
  const rows = (await host.call('chat_works')).data.submissions;
  assert.equal(rows[0].id, a.submissionId);
  assert.equal(rows[0].creation.prompt, args.prompt);
  assert.equal(rows[0].snapshot, undefined);
  assert.equal(JSON.stringify(rows).includes('fake-key'), false);
  assert.equal(fake.requests.filter(r => r.path.endsWith('/images/generations')).length, 1);
  assert.equal(fake.requests.filter(r => r.path === '/result.png').length, 1, 'replay reuses the saved file');
  const posted = fake.requests.find(r => r.path.endsWith('/images/generations')).body;
  assert.equal(posted.prompt, args.prompt);
  assert.equal(posted.aspect_ratio, '9:16');
  assert.equal(posted.resolution, '2K');
  assert.equal(posted.n, 1);
  assert.equal(posted.provider_options.volcengine.watermark, false);
  const conflict = await host.tools.get('mote_image').execute({ ...args, prompt: 'different' }, context);
  assert.equal(conflict.code, 'submission_conflict');
});

test('chat polling restores the original channel and saves a completed result without another generation', async (t) => {
  const fake = await createFakeUpstream(t, ({ path, body }) => {
    if (path.endsWith('/models')) return { data: { data: [model] } };
    if (path.endsWith('/images/generations')) return { data: { id: 'shared-task', type: 'image', model: body.model, status: 'queued' } };
    if (path === '/b/media/v1/tasks/shared-task') return { data: { id: 'shared-task', model: model.id, type: 'image', status: 'succeeded', artifacts: [{ kind: 'image', state: 'available', url: `${fake.baseUrl}/result.png` }] } };
    if (path === '/result.png') return { bytes: Buffer.from('image') };
    return { status: 404, data: {} };
  });
  const host = await createTestHost(t, { channels: ['a', 'b'].map(id => ({ id, baseUrl: `${fake.baseUrl}/${id}`, apiKey: 'fake-key' })) });
  const first = await host.tools.get('mote_image').execute({ prompt: 'test', model: model.id, channel: 'b', wait_seconds: 0 }, context);
  assert.equal(first.task.status, 'queued');
  host.restart();
  const final = await host.tools.get('mote_media_task').execute({ action: 'status', submission_id: first.submissionId });
  assert.equal(final.task.status, 'succeeded');
  assert.equal(final.saved.length, 1);
  assert.equal(final.creation.params.resolution, '2K');
  assert.equal(fake.requests.some(r => r.path === '/a/media/v1/tasks/shared-task'), false);
  assert.equal(fake.requests.filter(r => r.path.endsWith('/images/generations')).length, 1);
});

test('an unknown chat submission keeps its recovery id across reloads and is never submitted again', async (t) => {
  const fake = await createFakeUpstream(t, ({ path }) => path.endsWith('/models')
    ? { data: { data: [model] } } : { status: 500, data: { error: { message: 'acceptance unknown' } } });
  const host = await createTestHost(t, { channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const args = { prompt: 'test', wait_seconds: 0 };
  const first = await host.tools.get('mote_image').execute(args, context);
  assert.equal(first.state, 'unknown');
  assert.equal(typeof first.submissionId, 'string');
  host.restart();
  const replay = await host.tools.get('mote_image').execute(args, context);
  const recovered = await host.tools.get('mote_media_task').execute({ action: 'status', submission_id: first.submissionId });
  assert.equal(replay.state, 'unknown');
  assert.equal(recovered.state, 'unknown');
  assert.equal('task' in recovered, false);
  assert.equal(fake.requests.filter(r => r.path.endsWith('/images/generations')).length, 1);
});

test('unsupported image settings are rejected before generation rather than silently changed', async (t) => {
  const fake = await createFakeUpstream(t, () => ({ data: { data: [model] } }));
  const host = await createTestHost(t, { channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  for (const settings of [{ resolution: '4K' }, { n: 16 }, { n: 1.5 }, { n: 0 }, { channel: 'missing' }, { size: '1024x1024', aspect_ratio: '1:1' }, { references: ['first-id', 'second-id'] }]) {
    const result = await host.tools.get('mote_image').execute({ prompt: 'test', ...settings });
    assert.ok(result.error, JSON.stringify(settings));
  }
  assert.equal(fake.requests.every(r => r.path.endsWith('/models')), true);
});

test('cancelling an in-flight image call preserves an unknown receipt that cannot dispatch again', async (t) => {
  const controller = new AbortController();
  const fake = await createFakeUpstream(t, ({ path }) => {
    if (path.endsWith('/models')) return { data: { data: [model] } };
    controller.abort();
    return { disconnect: true };
  });
  const host = await createTestHost(t, { channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const args = { prompt: 'test', wait_seconds: 0 };
  await assert.rejects(host.tools.get('mote_image').execute(args, { ...context, signal: controller.signal }), { name: 'AbortError' });
  host.restart();
  const replay = await host.tools.get('mote_image').execute(args, context);
  assert.equal(replay.state, 'unknown');
  assert.equal(fake.requests.filter(r => r.path.endsWith('/images/generations')).length, 1);
});

test('a download failure retains the usable result and retries only the download', async (t) => {
  let available = false;
  const fake = await createFakeUpstream(t, ({ path }) => {
    if (path.endsWith('/models')) return { data: { data: [model] } };
    if (path.endsWith('/images/generations')) return { data: { id: 'download-only', type: 'image', status: 'succeeded', artifacts: [{ kind: 'image', state: 'available', url: `${fake.baseUrl}/result.png` }] } };
    if (path === '/result.png') return available ? { bytes: Buffer.from('image') } : { status: 403, data: {} };
    return { status: 404, data: {} };
  });
  const host = await createTestHost(t, { channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const first = await host.tools.get('mote_image').execute({ prompt: 'test', wait_seconds: 0 }, context);
  assert.equal(first.task.status, 'succeeded');
  assert.ok(first.saved[0].error);
  const meta = host.tools.get('mote_image').output.presentationMeta({}, first).moteMedia;
  assert.equal(meta.images[0].url, `${fake.baseUrl}/result.png`);
  available = true;
  const downloaded = await host.tools.get('mote_media_task').execute({ action: 'download', submission_id: first.submissionId });
  assert.equal(downloaded.saved[0].error, undefined);
  assert.equal(fake.requests.filter(r => r.path.endsWith('/images/generations')).length, 1);
});
