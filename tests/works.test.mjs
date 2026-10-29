import assert from 'node:assert/strict';
import test from 'node:test';
import { isPending, statusLabel, primaryMedia, diagnosticsOf, normalizeWorks, mergeWorkTask, downloadOutcome, removeWork } from '../src/client/domain/works.js';

test('polling status and status labels preserve known and unknown task states', () => {
  for (const status of ['queued', 'running', 'reconciling']) assert.equal(isPending({ status }), true);
  for (const status of ['succeeded', 'failed', 'cancelled', 'unknown']) assert.equal(isPending({ status }), false);
  for (const status of ['queued', 'running', 'reconciling', 'succeeded', 'failed', 'cancelled']) {
    assert.equal(statusLabel(status, (key) => `translated:${key}`), `translated:${status}`);
  }
  assert.equal(statusLabel('future-status', () => { throw new Error('unexpected translation'); }), 'future-status');
  assert.equal(statusLabel(null, () => {}), '');
});

test('video preview picks the available video rather than its cover and proxies LAN media', () => {
  const source = 'http://192.168.1.20/movie.mp4?signature=test';
  const expiresAt = '2026-10-29T00:00:00Z';
  const media = primaryMedia({ type: 'video', artifacts: [
    { kind: 'image', state: 'available', url: 'https://cdn.example.test/cover.png' },
    { kind: 'video', state: 'pending', url: 'https://cdn.example.test/pending.mp4' },
    { kind: 'video', state: 'available', url: source, expiresAt },
  ] });
  assert.deepEqual(media, {
    source, url: `/api/mote-media/asset?url=${encodeURIComponent(source)}`, video: true, expiresAt: Date.parse(expiresAt),
  });
});

test('public and inline media stay usable and missing media yields no preview', () => {
  for (const url of ['https://cdn.example.test/image.png', 'data:image/png;base64,test', '/api/mote-media/asset?path=image.png']) {
    assert.deepEqual(primaryMedia({ type: 'image', artifacts: [{ kind: 'image', state: 'available', url, expiresAt: 'invalid' }] }), {
      url, source: url, video: false, expiresAt: null,
    });
  }
  assert.equal(primaryMedia({ type: 'image' }), null);
  assert.equal(primaryMedia({ type: 'image', artifacts: [null, { state: 'pending', url: 'https://cdn.example.test/image.png' }] }), null);
});

test('diagnostic export retains task context without modifying the work', () => {
  const work = { type: 'image', model: 'test-model', taskId: 'task-1', requestId: 'request-1', status: 'failed',
    error: { code: 'invalid_request', retryable: false }, billing: { amount: '0' }, prompt: 'test prompt', params: { seed: 0 },
  };
  assert.deepEqual(JSON.parse(diagnosticsOf(work)), {
    type: work.type, model: work.model, task: work.taskId, request: work.requestId, status: work.status,
    submission: null, channel: null, artifactIndex: null,
    error: work.error, billing: work.billing, prompt: work.prompt, params: work.params,
  });
  const minimal = JSON.parse(diagnosticsOf({ type: 'video', status: 'queued' }));
  assert.equal(minimal.task, null);
  assert.equal(minimal.request, null);
  assert.deepEqual(minimal.params, {});
});

test('immediate and polled multi-image tasks display distinct outputs without duplicate cards', () => {
  const artifacts = ['first', 'second'].map((name, index) => ({ index, kind: 'image', state: 'available', url: `https://cdn.test/${name}.png` }));
  const base = { id: 'work', taskId: 'task', type: 'image', status: 'queued' };
  const completed = { id: 'task', status: 'succeeded', artifacts };
  const immediate = normalizeWorks([{ ...base, ...completed, id: 'work' }]);
  const polled = mergeWorkTask([base], 'task', completed);
  assert.deepEqual(immediate.map((item) => primaryMedia(item).source), artifacts.map((item) => item.url));
  assert.deepEqual(polled.map((item) => primaryMedia(item).source), artifacts.map((item) => item.url));
  assert.equal(normalizeWorks(polled).length, 2);
  assert.equal(mergeWorkTask(polled, 'task', completed).length, 2);
  const video = normalizeWorks([{ id: 'video', type: 'video', taskId: 'v', status: 'succeeded', artifacts: [
    { kind: 'image', state: 'available', url: 'https://cdn.test/cover.png' },
    { kind: 'video', state: 'available', url: 'https://cdn.test/video.mp4' },
    { kind: 'last_frame', state: 'available', url: 'https://cdn.test/end.png' },
  ] }]);
  assert.equal(video.length, 1);
  assert.equal(primaryMedia(video[0]).source, 'https://cdn.test/video.mp4');
});

test('download outcomes count actual success and retain each failed filename and reason', () => {
  assert.deepEqual(downloadOutcome({ saved: [{ path: 'C:/output/one.png' }, { path: 'C:/output/two.png', error: 'HTTP 403' }] }), {
    succeeded: 1, failed: [{ path: 'C:/output/two.png', error: 'HTTP 403' }],
  });
  assert.deepEqual(downloadOutcome({ saved: [] }), { succeeded: 0, failed: [] });
});

test('removing one output does not recreate it on the next task update', () => {
  const task = { id: 'task', status: 'succeeded', artifacts: [0, 1].map((index) => ({ kind: 'image', state: 'available', url: `https://cdn.test/${index}.png` })) };
  const items = normalizeWorks([{ id: 'work', taskId: task.id, type: 'image', ...task, id: 'work' }]);
  const next = mergeWorkTask(removeWork(items, items[0]), task.id, task);
  assert.equal(next.length, 1); assert.equal(primaryMedia(next[0]).source, 'https://cdn.test/1.png');
});
