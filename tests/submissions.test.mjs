import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestHost } from './support/host.mjs';
import { createFakeUpstream } from './support/upstream.mjs';

test('a prepared generation is submitted once across concurrent calls and Host reloads', async (t) => {
  const fake = await createFakeUpstream(t, ({ path, body }) => {
    if (path === '/media/v1/models') return { data: { data: [{ id: 'test-image', type: 'image' }] } };
    if (path === '/media/v1/images/generations') return { data: { id: 'task-one', type: 'image', model: body.model, status: 'succeeded', artifacts: [] } };
    return { status: 404, data: {} };
  });
  const host = await createTestHost(t, { channels: [{ id: 'mote', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const snapshot = { kind: 'image', channelId: 'mote', model: 'test-image', prompt: 'test', params: { n: 1 },
    references: [{ role: 'reference', type: 'image', url: 'data:image/png;base64,AQID', name: 'reference.png' }],
  };
  const prepared = await host.call('prepare', { submissionId: 'submission-one', snapshot });
  assert.equal(prepared.data.ok, true);
  const [a, b] = await Promise.all([host.call('generate', { submissionId: 'submission-one' }), host.call('generate', { submissionId: 'submission-one' })]);
  assert.equal(a.data.task.id, 'task-one');
  assert.equal(b.data.task.id, 'task-one');
  host.restart();
  const restored = await host.call('submission', { submissionId: 'submission-one', includeSnapshot: true });
  assert.deepEqual(restored.data.submission.snapshot, snapshot);
  const replay = await host.call('generate', { submissionId: 'submission-one' });
  assert.equal(replay.data.task.id, 'task-one');
  assert.equal(fake.requests.filter(({ path }) => path.endsWith('/images/generations')).length, 1);
});

for (const driver of ['mote', 'openai-images']) test(`${driver} unknown provider responses never retry or create another task after reload`, async (t) => {
  const fake = await createFakeUpstream(t, ({ path }) => path.endsWith('/models')
    ? { data: { data: [{ id: 'test-image', type: 'image' }] } }
    : { status: 500, data: { error: { message: 'unconfirmed acceptance' } } });
  const host = await createTestHost(t, { channels: [{ id: 'test', driver, baseUrl: fake.baseUrl, apiKey: 'fake-key', models: ['test-image'] }] });
  const snapshot = { kind: 'image', channelId: 'test', model: 'test-image', prompt: 'test', params: {}, references: [] };
  await host.call('prepare', { submissionId: 'unconfirmed', snapshot });
  const first = await host.call('generate', { submissionId: 'unconfirmed' });
  assert.equal(first.data.submission.state, 'unknown');
  host.restart();
  const second = await host.call('generate', { submissionId: 'unconfirmed' });
  assert.equal(second.data.submission.state, 'unknown');
  const collision = await host.call('prepare', { submissionId: 'unconfirmed', snapshot: { ...snapshot, prompt: 'different input' } });
  assert.equal(collision.data.error.code, 'submission_conflict');
  assert.equal(fake.requests.filter(({ path }) => path.endsWith('/images/generations')).length, 1);
});

test('a second Host instance cannot dispatch an attempt already in flight', { timeout: 5000 }, async (t) => {
  let arrived, release;
  const arrival = new Promise((resolve) => { arrived = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  t.after(() => release());
  const fake = await createFakeUpstream(t, async ({ path }) => {
    if (path.endsWith('/models')) return { data: { data: [{ id: 'test-image', type: 'image' }] } };
    arrived(); await gate;
    return { data: { id: 'accepted-task', status: 'succeeded', type: 'image', artifacts: [] } };
  });
  const host = await createTestHost(t, { channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  await host.call('prepare', { submissionId: 'in-flight', snapshot: { kind: 'image', channelId: 'test', model: 'test-image', prompt: 'test' } });
  const original = host.call('generate', { submissionId: 'in-flight' });
  await arrival;
  host.restart();
  const concurrent = await host.call('generate', { submissionId: 'in-flight' });
  assert.equal(concurrent.data.submission.state, 'unknown');
  assert.equal(fake.requests.filter(({ path }) => path.endsWith('/images/generations')).length, 1);
  release(); await original;
  const restored = await host.call('submission', { submissionId: 'in-flight' });
  assert.equal(restored.data.submission.task.id, 'accepted-task');
});

test('a pending video receipt restores its frames and queries only its original channel after reload', async (t) => {
  const fake = await createFakeUpstream(t, ({ path, body }) => {
    if (path.endsWith('/models')) return { data: { data: [{ id: 'same-video', type: 'video' }] } };
    if (path.endsWith('/videos/generations')) return { data: { id: 'pending-video', status: 'queued', type: 'video', model: body.model } };
    if (path === '/b/media/v1/tasks/pending-video') return { data: { id: 'pending-video', status: 'succeeded', type: 'video' } };
    return { status: 404, data: {} };
  });
  const host = await createTestHost(t, { channels: ['a', 'b'].map((id) => ({ id, baseUrl: `${fake.baseUrl}/${id}`, apiKey: `fake-${id}` })) });
  const snapshot = { kind: 'video', channelId: 'b', model: 'same-video', prompt: 'motion', params: { duration: 5, seed: 0, generate_audio: false }, references: [
    { role: 'first_frame', type: 'image', url: 'data:image/png;base64,AQID', name: 'start.png' },
    { role: 'last_frame', type: 'image', url: 'data:image/png;base64,BAUG', name: 'end.png' },
  ] };
  await host.call('prepare', { submissionId: 'video', snapshot });
  await host.call('generate', { submissionId: 'video' });
  host.restart();
  const restored = await host.call('submission', { submissionId: 'video', includeSnapshot: true });
  assert.deepEqual(restored.data.submission.snapshot, snapshot);
  assert.equal(restored.data.submission.task.status, 'succeeded');
  const submitted = fake.requests.find(({ path }) => path.endsWith('/videos/generations'));
  assert.equal(submitted.path, '/b/media/v1/videos/generations');
  assert.equal(submitted.body.generate_audio, false);
  assert.equal(submitted.body.references.length, 2);
  assert.equal(fake.requests.some(({ path }) => path === '/a/media/v1/tasks/pending-video'), false);
});

test('owned local image references are snapshotted as bytes before generation and cannot escape the output directory', async (t) => {
  const host = await createTestHost(t, { channels: [{ id: 'test', baseUrl: 'https://not-contacted.test', apiKey: 'fake-key' }] });
  const state = await host.call('state');
  await mkdir(state.data.outputDir);
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  await writeFile(join(state.data.outputDir, 'reference.png'), bytes);
  const snapshot = { kind: 'image', channelId: 'test', model: 'image', prompt: 'test', params: {}, references: [{ role: 'reference', type: 'image', url: '/api/mote-media/asset?path=reference.png' }] };
  await host.call('prepare', { submissionId: 'local-reference', snapshot });
  const restored = await host.call('submission', { submissionId: 'local-reference', includeSnapshot: true });
  assert.equal(restored.data.submission.snapshot.references[0].url, `data:image/png;base64,${bytes.toString('base64')}`);
  const escaped = await host.call('prepare', { submissionId: 'escape', snapshot: { ...snapshot, references: [{ role: 'reference', type: 'image', url: '/api/mote-media/asset?path=../outside.png' }] } });
  assert.equal(escaped.data.ok, false);
});
