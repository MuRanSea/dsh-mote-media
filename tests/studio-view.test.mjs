import assert from 'node:assert/strict';
import test from 'node:test';
import { React, createDom, button, menuButton } from './support/dom.mjs';
import { createStudio } from '../src/client/app/Studio.js';
import { STUDIO_CSS } from '../src/client/styles/studio.js';
import { createWorksStorage } from '../src/client/storage/works-storage.js';

const image = { id: 'test-image', channelId: 'test', channelName: 'test', parameters: { aspect_ratio: { enum: ['1:1', '16:9'], default: '1:1' }, n: { minimum: 1, maximum: 2, default: 1 } }, references: [] };
const video = { id: 'test-video', channelId: 'test', channelName: 'test', parameters: {
  duration: { minimum: 3, maximum: 6, default: 5 }, resolution: { enum: ['720p', '1080p'], default: '720p' }, generate_audio: { default: false },
}, references: [{ role: 'first_frame', types: ['image'], max_count: 1 }, { role: 'last_frame', types: ['image'], max_count: 1 }] };
const locale = { t: (key) => key, getIdeas: () => ['test idea'] };

function timers(t, window) {
  let nextId = 0;
  const timeouts = new Map();
  const intervals = new Map();
  t.mock.method(window, 'setTimeout', (callback, delay) => { const id = ++nextId; timeouts.set(id, { callback, delay }); return id; });
  t.mock.method(window, 'clearTimeout', (id) => timeouts.delete(id));
  t.mock.method(window, 'setInterval', (callback, delay) => { const id = ++nextId; intervals.set(id, { callback, delay }); return id; });
  t.mock.method(window, 'clearInterval', (id) => intervals.delete(id));
  return {
    timeouts, intervals,
    async flush(delay) {
      await React.act(async () => {
        for (const [id, timer] of [...timeouts]) if (timer.delay === delay) { timeouts.delete(id); await timer.callback(); }
      });
    },
  };
}

function fakeHost() {
  const calls = [];
  const submissions = new Map();
  return {
    calls,
    async call(action, payload) {
      calls.push({ action, payload });
      if (action === 'state') return { configured: true, imageModel: image.id, videoModel: video.id, channels: [] };
      if (action === 'chat_works') return { submissions: [] };
      if (action === 'models') return { models: payload.category === 'image' ? [image] : [video] };
      if (action === 'tasks') return { tasks: payload.ids.map((id) => ({ id, task: { id, status: 'succeeded', progress: 100, artifacts: [{ kind: 'image', state: 'available', url: 'https://cdn.example.test/result.png' }] } })) };
      if (action === 'prepare') {
        const entry = { id: payload.submissionId, state: 'prepared', snapshotAvailable: true, snapshot: payload.snapshot, channelId: payload.snapshot.channelId };
        submissions.set(entry.id, entry); return { submission: entry };
      }
      if (action === 'generate') {
        const entry = submissions.get(payload.submissionId);
        const task = { id: 'new-task', model: entry.snapshot.model, status: 'queued' };
        entry.state = 'accepted'; entry.task = task; return { submission: entry, task };
      }
      if (action === 'submission') return { submission: submissions.get(payload.submissionId) };
      if (action === 'submissions') return { submissions: payload.ids.map(id => {
        const entry = submissions.get(id);
        entry.task = { ...entry.task, status: 'succeeded', artifacts: [{kind: entry.snapshot.kind, state: 'available', url: 'https://cdn.example.test/result.png'}] };
        return { id, submission: entry };
      }) };
      throw new Error(`Unexpected test action: ${action}`);
    },
  };
}

test('chat works sync into Studio once and removed outputs stay removed after polling and reopening', async (t) => {
  const dom = await createDom(t);
  const clock = timers(t, dom.window);
  const host = fakeHost();
  const receipt = { id: 'chat-import', source: 'chat', kind: 'image', state: 'accepted', channelId: 'test', model: image.id,
    snapshotAvailable: true, createdAt: 10, creation: { prompt: 'optimized prompt', originalPrompt: 'short request', params: { n: 2 } },
    task: { id: 'chat-task', status: 'succeeded', artifacts: [0, 1].map(index => ({ index, kind: 'image', state: 'available', url: `https://cdn.example.test/chat-${index}.png` })) } };
  const call = async (action, payload) => action === 'chat_works' ? { submissions: [structuredClone(receipt)] } : host.call(action, payload);
  const storage = createWorksStorage();
  const Studio = createStudio(React, { locale, call, storage });
  await dom.render(Studio);
  assert.equal(dom.container.querySelectorAll('article').length, 2);
  const poll = [...clock.intervals.values()][0];
  await React.act(async () => poll.callback());
  assert.equal(dom.container.querySelectorAll('article').length, 2, 'sync does not duplicate outputs');
  await dom.click(dom.container.querySelector('button[aria-label="remove"]'));
  receipt.saved = [];
  await React.act(async () => poll.callback());
  assert.equal(dom.container.querySelectorAll('article').length, 1, 'the first artifact stays hidden on refresh');
  await dom.click(dom.container.querySelector('button[aria-label="remove"]'));
  await clock.flush(300);
  const Reopened = createStudio(React, { locale, call, storage });
  await dom.render(Reopened);
  assert.equal(dom.container.querySelectorAll('article').length, 0, 'an entirely removed chat work stays hidden after reopening');
  assert.deepEqual(storage.loadHiddenChat(), ['chat-import']);
  assert.equal(host.calls.some(row => row.action === 'generate'), false);
});

test('Studio resumes stored tasks, persists updates and releases polling/save timers on unmount', async (t) => {
  const dom = await createDom(t);
  const clock = timers(t, dom.window);
  const host = fakeHost();
  const saved = [];
  const Studio = createStudio(React, { locale, call: host.call, storage: {
    loadItems: () => [{ id: 'existing-work', type: 'image', model: image.id, taskId: 'existing-task', status: 'queued' }],
    saveItems: (items) => saved.push(structuredClone(items)),
  } });
  await dom.render(Studio);
  assert.equal(dom.container.querySelector('style').textContent, STUDIO_CSS);
  assert.equal(dom.container.querySelectorAll('article').length, 1);
  assert.ok(dom.container.querySelector('.jz-tile-pending'));
  assert.equal(clock.intervals.size, 1);
  const poll = [...clock.intervals.values()][0];
  assert.equal(poll.delay, 3000);
  await clock.flush(300);
  assert.equal(saved[0][0].taskId, 'existing-task');
  await React.act(async () => poll.callback());
  assert.equal(dom.container.querySelector('.jz-tile-pending'), null);
  assert.ok(dom.container.querySelector('img[src="https://cdn.example.test/result.png"]'));
  await clock.flush(300);
  assert.equal(saved.at(-1)[0].status, 'succeeded');
  assert.equal(saved.at(-1)[0].id, 'existing-work');
  assert.equal(clock.intervals.size, 1);
  await dom.unmount();
  assert.equal(clock.intervals.size, 0);
  assert.equal(clock.timeouts.size, 0);
});

test('Studio preserves composer identity, video mode parameters and generation/preview callbacks', async (t) => {
  const dom = await createDom(t);
  const clock = timers(t, dom.window);
  const host = fakeHost();
  const Studio = createStudio(React, { locale, call: host.call, storage: { loadItems: () => [], saveItems() {} } });
  await dom.render(Studio);
  const textarea = dom.container.querySelector('textarea');
  await dom.text(textarea, '  test motion  ');
  assert.equal(dom.container.querySelector('textarea'), textarea);
  assert.equal(textarea.value, '  test motion  ');
  assert.equal(dom.container.querySelector('.jz-head').textContent.includes('modeVideo'), false);
  await dom.click(menuButton(dom.container, 'typeLabel'));
  await dom.click(button(dom.container, 'modeVideo'));
  assert.equal(dom.container.querySelector('textarea'), textarea);
  assert.deepEqual([...dom.container.querySelectorAll('.jz-slot')].map((element) => element.title), ['firstFrame', 'lastFrame']);
  await dom.text(textarea, '  test motion  ');
  await dom.click(menuButton(dom.container, 'durationLabel'));
  await dom.click(button(dom.container, '6secondsSuffix'));
  await dom.click(dom.container.querySelector('.jz-send'));
  const prepared = host.calls.find(({ action }) => action === 'prepare');
  const submitted = host.calls.find(({ action }) => action === 'generate');
  assert.equal(submitted.payload.submissionId, prepared.payload.submissionId);
  assert.deepEqual(prepared.payload.snapshot, {
    kind: 'video', channelId: 'test', model: video.id, prompt: 'test motion', params: { duration: 6, resolution: '720p', generate_audio: false }, references: [],
  });
  assert.equal(dom.container.querySelectorAll('article').length, 1);
  assert.equal(dom.container.querySelector('.jz-count').textContent, '1');
  await React.act(async () => [...clock.intervals.values()][0].callback());
  await dom.click(dom.container.querySelector('button[title="preview"]'));
  assert.ok(dom.container.querySelector('.jz-lightbox'));
  await dom.click(button(dom.container, 'close'));
  assert.equal(dom.container.querySelector('.jz-lightbox'), null);
  assert.equal(clock.intervals.size, 1);
});

test('Studio keeps the draft and does not submit a paid request when the recovery record cannot be saved', async (t) => {
  const dom = await createDom(t);
  timers(t, dom.window);
  const host = fakeHost();
  const call = async (action, payload) => action === 'prepare' ? { submission: { id: payload.submissionId, state: 'prepared', snapshotAvailable: true } } : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [], saveItems: () => false } });
  await dom.render(Studio);
  await dom.text(dom.container.querySelector('textarea'), 'keep this draft');
  await dom.click(dom.container.querySelector('.jz-send'));
  assert.equal(host.calls.filter(({ action }) => action === 'generate').length, 0);
  assert.equal(dom.container.querySelector('textarea').value, 'keep this draft');
  assert.ok(dom.container.querySelector('.jz-error'));
});

test('an independent batch captures its inputs once and ignores repeated shortcuts while continuing after a lost child response', async t => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const attempts = [];
  let durable = [];
  const call = async (action, payload) => {
    if (action === 'generate') {
      attempts.push(payload.submissionId);
      assert.equal(durable.length, 3);
      if (attempts.length === 1) {
        await gate;
        await host.call(action, payload);
        throw new Error('first response lost');
      }
    }
    return host.call(action, payload);
  };
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [], saveItems: rows => { durable = structuredClone(rows); return true; } } });
  await dom.render(Studio);
  await dom.text(dom.container.querySelector('textarea'), 'captured batch prompt');
  await dom.click(menuButton(dom.container, 'countLabel')); await dom.click(button(dom.container, '3countSuffix'));
  await dom.click(dom.container.querySelector('.jz-send'));
  assert.equal(attempts.length, 1);
  assert.equal(dom.container.querySelector('.jz-send').disabled, true);
  await dom.text(dom.container.querySelector('textarea'), 'next batch prompt');
  await dom.click(menuButton(dom.container, 'countLabel')); await dom.click(button(dom.container, '4countSuffix'));
  await React.act(async () => {
    const textarea = dom.container.querySelector('textarea');
    textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  });
  assert.equal(attempts.length, 1);
  await React.act(async () => release());
  assert.equal(new Set(attempts).size, 3);
  assert.equal(attempts.length, 3);
  const snapshots = host.calls.filter(row => row.action === 'prepare').map(row => row.payload.snapshot);
  assert.ok(snapshots.every(row => row.prompt === 'captured batch prompt' && row.params.n === 1 && row.params.waitSeconds === 0));
  assert.equal(dom.container.querySelectorAll('article').length, 3);
  assert.match(dom.container.textContent, /submissionUnknownHint/);
  assert.equal(dom.container.querySelector('textarea').value, 'next batch prompt');
  await dom.click(button(dom.container, 'recover'));
  assert.equal(attempts.length, 3, 'recover only queries the original child');
});

test('closing Studio during an independent batch stops unsent children and keeps their prepared recovery records', async t => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const attempts = [];
  let durable = [];
  const call = async (action, payload) => {
    if (action === 'generate') { attempts.push(payload.submissionId); await gate; }
    return host.call(action, payload);
  };
  const storage = { loadItems: () => durable, saveItems: rows => { durable = structuredClone(rows); return true; } };
  const Studio = createStudio(React, { locale, call, storage });
  await dom.render(Studio);
  await dom.text(dom.container.querySelector('textarea'), 'original');
  await dom.click(menuButton(dom.container, 'countLabel')); await dom.click(button(dom.container, '3countSuffix'));
  await dom.click(dom.container.querySelector('.jz-send'));
  assert.equal(durable.length, 3);
  assert.equal(durable.filter(row => row.status === 'prepared').length, 3);
  await dom.render(() => null);
  await React.act(async () => release());
  assert.equal(attempts.length, 1);
  const Reopened = createStudio(React, { locale, call, storage });
  await dom.render(Reopened);
  assert.equal(dom.container.querySelectorAll('article').length, 3);
  assert.equal(attempts.length, 1, 'opening Studio does not auto-submit prepared children');
});

test('an old multi-image work generates only one new single-image task regardless of the current image count', async t => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  const snapshot = { kind: 'image', channelId: 'test', model: image.id, prompt: 'old image', params: { n: 4, aspect_ratio: '16:9' }, references: [] };
  const call = (action, payload) => action === 'submission' && payload.submissionId === 'legacy-group'
    ? Promise.resolve({ submission: { id: 'legacy-group', state: 'failed', snapshot } }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: {
    loadItems: () => [{ id: 'legacy-group', submissionId: 'legacy-group', type: 'image', status: 'failed', snapshotAvailable: true }], saveItems: () => true,
  } });
  await dom.render(Studio);
  await dom.click(menuButton(dom.container, 'countLabel')); await dom.click(button(dom.container, '3countSuffix'));
  await dom.click(button(dom.container, 'regenerate'));
  const prepared = host.calls.filter(row => row.action === 'prepare');
  assert.equal(prepared.length, 1);
  assert.equal(prepared[0].payload.snapshot.params.n, 1);
  assert.equal(prepared[0].payload.snapshot.prompt, snapshot.prompt);
  assert.equal(host.calls.filter(row => row.action === 'generate').length, 1);
  assert.match(menuButton(dom.container, 'countLabel').textContent, /3countSuffix/);
});

test('a lost response leaves a recoverable record and recovery never generates a second task', async (t) => {
  const dom = await createDom(t);
  const clock = timers(t, dom.window);
  const host = fakeHost();
  const persisted = [];
  const call = async (action, payload) => {
    const result = await host.call(action, payload);
    if (action === 'generate') throw Object.assign(new Error('response lost'), { submissionUnknown: true });
    return result;
  };
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [], saveItems: (items) => { persisted.push(structuredClone(items)); return true; } } });
  await dom.render(Studio);
  await dom.text(dom.container.querySelector('textarea'), 'test');
  await dom.click(dom.container.querySelector('.jz-send'));
  assert.equal(persisted[0][0].submissionId, host.calls.find(({ action }) => action === 'prepare').payload.submissionId);
  assert.ok(dom.container.textContent.includes('submissionUnknownHint'));
  assert.equal([...dom.container.querySelectorAll('button')].some((node) => node.textContent === 'regenerate'), false);
  await dom.click(dom.container.querySelector('button[title="preview"]'));
  await dom.click(button(dom.container.querySelector('.jz-lightbox'), 'recover'));
  assert.equal(dom.container.querySelector('.jz-detail-heading .jz-status-badge').textContent, 'queued');
  await React.act(async () => [...clock.intervals.values()][0].callback());
  assert.equal(dom.container.querySelector('.jz-detail-heading .jz-status-badge').textContent, 'succeeded');
  assert.ok(dom.container.querySelector('img[src="https://cdn.example.test/result.png"]'));
  assert.equal(host.calls.filter(({ action }) => action === 'generate').length, 1);
});

test('recovering an undispatched draft requires an explicit continue using the same id', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost(); let attempts = 0;
  const ids = [];
  const call = async (action, payload) => {
    if (action === 'generate') { ids.push(payload.submissionId); if (++attempts === 1) throw new Error('not delivered'); }
    return host.call(action, payload);
  };
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [], saveItems: () => true } });
  await dom.render(Studio); await dom.text(dom.container.querySelector('textarea'), 'draft');
  await dom.click(dom.container.querySelector('.jz-send'));
  await dom.click(button(dom.container, 'recover'));
  assert.equal(host.calls.filter(({ action }) => action === 'generate').length, 0);
  await dom.click(button(dom.container, 'continueSubmission'));
  assert.equal(ids[0], ids[1]);
  assert.equal(host.calls.filter(({ action }) => action === 'generate').length, 1);
});

test('generate again uses the complete Host snapshot and a fresh id rather than the current form', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  const snapshot = { kind: 'video', channelId: 'original-channel', model: 'original-model', prompt: 'original prompt', params: { seed: 0, duration: 6, generate_audio: false }, references: [
    { role: 'first_frame', type: 'image', url: 'data:image/png;base64,AQID', name: 'start.png' },
    { role: 'last_frame', type: 'image', url: 'data:image/png;base64,BAUG', name: 'end.png' },
  ] };
  const call = (action, payload) => action === 'submission' && payload.submissionId === 'original'
    ? Promise.resolve({ submission: { id: 'original', state: 'failed', snapshotAvailable: true, snapshot } }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'original', submissionId: 'original', type: 'video', status: 'failed', snapshotAvailable: true }], saveItems: () => true } });
  await dom.render(Studio);
  await dom.text(dom.container.querySelector('textarea'), 'unrelated new form');
  await dom.click(button(dom.container, 'regenerate'));
  const prepared = host.calls.find(({ action }) => action === 'prepare');
  assert.deepEqual(prepared.payload.snapshot, snapshot);
  assert.notEqual(prepared.payload.submissionId, 'original');
  assert.equal(dom.container.querySelector('textarea').value, 'unrelated new form');
});

test('selecting the second channel for an identical model id submits that channel', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  const choices = ['a', 'b'].map((id) => ({ ...image, id: 'same-model', channelId: id, channelName: id.toUpperCase() }));
  const call = (action, payload) => action === 'models' && payload.category === 'image' ? Promise.resolve({ models: choices }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [], saveItems: () => true } });
  await dom.render(Studio);
  await dom.click(menuButton(dom.container, 'modelLabel'));
  await dom.click([...dom.container.querySelectorAll('.jz-drop-item')].at(-1));
  assert.ok(dom.container.textContent.includes('B · same-model'));
  await dom.text(dom.container.querySelector('textarea'), 'test channel');
  await dom.click(dom.container.querySelector('.jz-send'));
  const prepared = host.calls.find(({ action }) => action === 'prepare');
  assert.equal(prepared.payload.snapshot.channelId, 'b');
  assert.equal(prepared.payload.snapshot.model, 'same-model');
});

test('partial download feedback reports only actual saved files and each failure', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  const call = (action, payload) => action === 'download' ? Promise.resolve({ dir: 'C:/output', saved: [{ path: 'one.png' }, { path: 'blocked.png', error: 'permission denied' }] }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'work', taskId: 'task', type: 'image', status: 'succeeded', artifacts: [{ kind: 'image', state: 'available', url: 'https://cdn.test/result.png' }] }], saveItems: () => true } });
  await dom.render(Studio);
  await dom.click(dom.container.querySelector('button[title="download"]'));
  const message = dom.container.querySelector('.jz-error').textContent;
  assert.match(message, /saved 1/); assert.match(message, /downloadFailed 1/); assert.match(message, /blocked.png: permission denied/);
});

test('repeated generate-again clicks during snapshot loading create only one new intent', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost(); let release; let reads = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const snapshot = { kind: 'image', channelId: 'test', model: image.id, prompt: 'original', params: {}, references: [] };
  const call = (action, payload) => {
    if (action === 'submission') { reads += 1; return gate; }
    return host.call(action, payload);
  };
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'old', submissionId: 'old', type: 'image', status: 'failed', snapshotAvailable: true }], saveItems: () => true } });
  await dom.render(Studio);
  await dom.click(button(dom.container, 'regenerate')); await dom.click(button(dom.container, 'regenerate'));
  assert.equal(reads, 1);
  await React.act(async () => release({ submission: { id: 'old', state: 'failed', snapshot } }));
  assert.equal(host.calls.filter(({ action }) => action === 'generate').length, 1);
});

test('switching modes preserves independent prompts, models, parameters and reference slots without generating', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  const editableImage = { ...image, id: 'second-image', references: [{ role: 'reference', types: ['image'], max_count: 2 }] };
  const call = (action, payload) => action === 'models' && payload.category === 'image'
    ? Promise.resolve({ models: [image, editableImage] }) : host.call(action, payload);
  const source = { id: 'source', type: 'image', model: image.id, status: 'succeeded', artifacts: [{ kind: 'image', state: 'available', url: 'https://cdn.test/reference.png' }] };
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [source], saveItems: () => true } });
  await dom.render(Studio);
  await dom.click(menuButton(dom.container, 'modelLabel'));
  await dom.click(button(dom.container, 'second-image'));
  await dom.text(dom.container.querySelector('textarea'), 'image draft');
  await dom.click(menuButton(dom.container, 'ratioLabel')); await dom.click(button(dom.container, '16:9'));
  await dom.click(menuButton(dom.container, 'countLabel')); await dom.click(button(dom.container, '3countSuffix'));
  await dom.click(dom.container.querySelector('button[title="reuse"]'));
  await dom.click(menuButton(dom.container, 'typeLabel')); await dom.click(button(dom.container, 'modeVideo'));
  assert.equal(dom.container.querySelector('textarea').value, '', 'a new mode starts its own draft');
  assert.equal(menuButton(dom.container, 'countLabel'), undefined);
  await dom.text(dom.container.querySelector('textarea'), 'video draft');
  await dom.click(menuButton(dom.container, 'durationLabel')); await dom.click(button(dom.container, '6secondsSuffix'));
  await dom.click(dom.container.querySelector('button[title="reuseFirst"]'));
  await dom.click(dom.container.querySelector('button[title="reuseLast"]'));
  await dom.click(menuButton(dom.container, 'typeLabel')); await dom.click(button(dom.container, 'modeImage'));
  assert.equal(dom.container.querySelector('textarea').value, 'image draft');
  assert.match(menuButton(dom.container, 'modelLabel').textContent, /second-image/);
  assert.match(menuButton(dom.container, 'ratioLabel').textContent, /16:9/);
  assert.match(menuButton(dom.container, 'countLabel').textContent, /3countSuffix/);
  assert.equal(dom.container.querySelectorAll('.jz-slot.filled').length, 1);
  await dom.click(menuButton(dom.container, 'typeLabel')); await dom.click(button(dom.container, 'modeVideo'));
  assert.equal(dom.container.querySelector('textarea').value, 'video draft');
  assert.match(menuButton(dom.container, 'durationLabel').textContent, /6secondsSuffix/);
  assert.equal(dom.container.querySelectorAll('.jz-slot.filled').length, 2);
  assert.equal(host.calls.some(({ action }) => ['prepare', 'generate'].includes(action)), false);
});

test('edit again restores the original channel and complete inputs, then submits changed inputs under a new id', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  const originalModel = { ...video, channelId: 'original-channel', channelName: 'Original', parameters: { ...video.parameters, seed: { default: -1 } },
    references: [...video.references, { role: 'reference', types: ['image'], max_count: 1 }] };
  const snapshot = { kind: 'video', channelId: 'original-channel', model: video.id, prompt: 'original motion',
    params: { duration: 6, resolution: '1080p', generate_audio: false, seed: 0 }, references: [
      { role: 'reference', type: 'image', url: 'data:image/png;base64,AQID', name: 'style.png' },
      { role: 'first_frame', type: 'image', url: 'data:image/png;base64,BAUG', name: 'start.png' },
      { role: 'last_frame', type: 'image', url: 'data:image/png;base64,BwgJ', name: 'end.png' },
    ] };
  const reads = [];
  const call = (action, payload) => {
    if (action === 'models' && payload.category === 'video') return Promise.resolve({ models: [video, originalModel] });
    if (action === 'submission' && payload.submissionId === 'original') { reads.push(payload); return Promise.resolve({ submission: { id: 'original', snapshot } }); }
    return host.call(action, payload);
  };
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'original', submissionId: 'original', type: 'video', status: 'failed', snapshotAvailable: true }], saveItems: () => true } });
  await dom.render(Studio);
  await dom.text(dom.container.querySelector('textarea'), 'my image draft');
  await dom.click(dom.container.querySelector('button[title="preview"]'));
  await dom.click(button(dom.container.querySelector('.jz-lightbox'), 'editAgain'));
  assert.deepEqual(reads, [{ submissionId: 'original', includeSnapshot: true }]);
  assert.equal(dom.container.querySelector('.jz-lightbox'), null);
  assert.equal(dom.window.document.activeElement, dom.container.querySelector('textarea'));
  assert.equal(dom.container.querySelector('textarea').value, 'original motion');
  assert.match(menuButton(dom.container, 'modelLabel').textContent, /Original/);
  assert.match(menuButton(dom.container, 'durationLabel').textContent, /6secondsSuffix/);
  assert.equal(dom.container.querySelector('button[aria-label="audioLabel"]').getAttribute('aria-pressed'), 'false');
  assert.deepEqual([...dom.container.querySelectorAll('.jz-slot.filled img')].map((node) => node.src), [snapshot.references[1].url, snapshot.references[2].url, snapshot.references[0].url]);
  assert.ok(dom.container.textContent.includes('editRestoredHint'));
  assert.equal(host.calls.some(({ action }) => ['prepare', 'generate'].includes(action)), false);
  await dom.click(menuButton(dom.container, 'typeLabel')); await dom.click(button(dom.container, 'modeImage'));
  assert.equal(dom.container.querySelector('textarea').value, 'my image draft');
  await dom.click(menuButton(dom.container, 'typeLabel')); await dom.click(button(dom.container, 'modeVideo'));
  await dom.text(dom.container.querySelector('textarea'), 'changed motion');
  await dom.click(dom.container.querySelector('.jz-send'));
  const prepared = host.calls.find(({ action }) => action === 'prepare');
  assert.notEqual(prepared.payload.submissionId, 'original');
  assert.deepEqual(prepared.payload.snapshot, { ...snapshot, prompt: 'changed motion' });
  assert.equal(host.calls.filter(({ action }) => action === 'generate').length, 1);
});

test('reference reuse rejects video media, respects model limits and never replaces occupied frames', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost();
  const limited = { ...image, id: 'limited', references: [{ role: 'reference', types: ['image'], max_count: 1 }] };
  const call = (action, payload) => action === 'models' && payload.category === 'image'
    ? Promise.resolve({ models: [limited, image] }) : host.call(action, payload);
  const work = (id, type) => ({ id, type, status: 'succeeded', model: image.id, artifacts: [{ kind: type, state: 'available', url: `https://cdn.test/${id}` }] });
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [work('image.png', 'image'), work('movie.mp4', 'video')], saveItems: () => true } });
  await dom.render(Studio);
  await dom.click(menuButton(dom.container, 'modelLabel')); await dom.click(button(dom.container, 'limited'));
  const mediaButton = (index) => dom.container.querySelectorAll('article')[index].querySelector('button[aria-label="reuse"],button[aria-label="reuseFirst"],button[aria-label="reuseLast"]');
  assert.equal(mediaButton(1).disabled, true);
  assert.equal(mediaButton(1).title, 'referenceImageOnly');
  await dom.click(mediaButton(1));
  assert.equal(dom.container.querySelectorAll('.jz-slot.filled').length, 0);
  await dom.click(mediaButton(0));
  assert.equal(dom.container.querySelectorAll('.jz-slot.filled').length, 1);
  assert.equal(mediaButton(0).disabled, true);
  assert.equal(mediaButton(0).title, 'refsFull');
  await dom.click(menuButton(dom.container, 'modelLabel')); await dom.click(button(dom.container, 'test-image'));
  assert.equal(dom.container.querySelectorAll('.jz-slot.filled').length, 1, 'incompatible existing references remain removable');
  assert.ok(dom.container.querySelector('.jz-error').textContent.includes('referenceUnsupported'));
  await dom.text(dom.container.querySelector('textarea'), 'requires checking');
  await React.act(async () => dom.container.querySelector('textarea').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })));
  assert.equal(host.calls.some(({ action }) => action === 'prepare'), false);
  await dom.click(menuButton(dom.container, 'typeLabel')); await dom.click(button(dom.container, 'modeVideo'));
  await dom.click(mediaButton(0)); await dom.click(mediaButton(0));
  const frames = [...dom.container.querySelectorAll('.jz-slot.filled img')].map((node) => node.src);
  assert.equal(frames.length, 2);
  assert.equal(mediaButton(0).disabled, true);
  assert.equal(mediaButton(0).title, 'framesFull');
  await dom.click(mediaButton(0));
  assert.deepEqual([...dom.container.querySelectorAll('.jz-slot.filled img')].map((node) => node.src), frames);
});

test('an upload still loading cannot overwrite inputs restored from another work', async (t) => {
  const dom = await createDom(t); timers(t, dom.window);
  const host = fakeHost(); let reader;
  t.mock.method(dom.window.FileReader.prototype, 'readAsDataURL', function () { reader = this; });
  const imageWithRefs = { ...image, references: [{ role: 'reference', types: ['image'], max_count: 2 }] };
  const snapshot = { kind: 'image', channelId: 'test', model: image.id, prompt: 'restored', params: {}, references: [
    { type: 'image', role: 'reference', url: 'https://cdn.test/restored.png', name: 'restored.png' },
  ] };
  const call = (action, payload) => action === 'models' && payload.category === 'image' ? Promise.resolve({ models: [imageWithRefs] })
    : action === 'submission' ? Promise.resolve({ submission: { snapshot } }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'original', submissionId: 'original', type: 'image', status: 'failed', snapshotAvailable: true }], saveItems: () => true } });
  await dom.render(Studio);
  const input = dom.container.querySelector('input[type="file"]');
  await React.act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['old'], 'old.png', { type: 'image/png' })] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await dom.click(button(dom.container, 'editAgain'));
  await React.act(async () => { Object.defineProperty(reader, 'result', { value: 'data:image/png;base64,AQID' }); reader.onload(); });
  assert.deepEqual([...dom.container.querySelectorAll('.jz-slot.filled img')].map((node) => node.src), ['https://cdn.test/restored.png']);
  assert.equal(dom.container.querySelector('textarea').value, 'restored');
  assert.ok(dom.container.querySelector('.jz-note').textContent.includes('uploadDraftChanged'));
});

test('unsupported restored references stay visible and block generation until explicitly removed', async (t) => {
  const dom = await createDom(t); timers(t, dom.window); const host = fakeHost();
  const supported = { ...image, references: [{ role: 'reference', types: ['image'], max_count: 2 }] };
  const snapshot = { kind: 'image', model: image.id, channelId: 'test', prompt: 'check inputs', params: {}, references: [
    { type: 'image', role: 'reference', url: 'https://cdn.test/image.png', name: 'image.png' },
    { type: 'audio', role: 'reference', asset_id: 'saved-audio', name: 'audio.mp3' },
    { type: 'image', role: 'first_frame', url: 'https://cdn.test/frame.png', name: 'wrong-frame.png' },
  ] };
  const call = (action, payload) => action === 'models' && payload.category === 'image' ? Promise.resolve({ models: [supported] })
    : action === 'submission' ? Promise.resolve({ submission: { snapshot } }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'old', submissionId: 'old', snapshotAvailable: true, type: 'image', status: 'failed' }], saveItems: () => true } });
  await dom.render(Studio); await dom.click(button(dom.container, 'editAgain'));
  assert.equal(dom.container.querySelectorAll('.jz-unhandled-refs button').length, 2);
  assert.match(dom.container.querySelector('.jz-unhandled-refs').textContent, /audio.mp3/);
  assert.match(dom.container.querySelector('.jz-unhandled-refs').textContent, /wrong-frame.png/);
  assert.equal(dom.container.querySelector('.jz-send').disabled, true);
  await React.act(async () => dom.container.querySelector('textarea').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })));
  assert.equal(host.calls.some(({ action }) => action === 'prepare'), false);
  await dom.click(dom.container.querySelector('.jz-unhandled-refs button'));
  await dom.click(dom.container.querySelector('.jz-unhandled-refs button'));
  assert.equal(dom.container.querySelector('.jz-send').disabled, false);
  await dom.click(dom.container.querySelector('.jz-send'));
  assert.deepEqual(host.calls.find(({ action }) => action === 'prepare').payload.snapshot.references, [snapshot.references[0]]);
});

test('legacy editing reports missing references and requires a model choice when the original channel is unavailable', async (t) => {
  const dom = await createDom(t); timers(t, dom.window); const host = fakeHost();
  const Studio = createStudio(React, { locale, call: host.call, storage: { loadItems: () => [{ id: 'legacy', type: 'video', channelId: 'removed-channel', model: video.id,
    status: 'failed', prompt: 'legacy motion', params: { duration: 6, generate_audio: false } }], saveItems: () => true } });
  await dom.render(Studio); await dom.click(button(dom.container, 'editAgain'));
  assert.equal(dom.container.querySelector('textarea').value, 'legacy motion');
  assert.ok(dom.container.querySelector('.jz-composer-notice').textContent.includes('editLegacyHint'));
  assert.ok(dom.container.querySelector('.jz-error').textContent.includes('editModelUnavailable'));
  assert.equal(dom.container.querySelector('.jz-send').disabled, true);
  assert.equal(host.calls.some(({ action }) => ['submission', 'prepare', 'generate'].includes(action)), false);
  await dom.click(menuButton(dom.container, 'modelLabel')); await dom.click(button(dom.container, video.id));
  assert.equal(dom.container.querySelector('.jz-send').disabled, false);
  assert.ok(dom.container.querySelector('.jz-composer-notice').textContent.includes('editLegacyHint'));
});

test('a delayed snapshot read preserves changes made while loading and cannot restore an unmounted page', async (t) => {
  const dom = await createDom(t); timers(t, dom.window); const host = fakeHost(); let release;
  const snapshot = { kind: 'image', channelId: 'test', model: image.id, prompt: 'old prompt', params: {}, references: [] };
  const call = (action, payload) => action === 'submission' ? new Promise((resolve) => { release = resolve; }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'old', submissionId: 'old', snapshotAvailable: true, type: 'image', status: 'failed' }], saveItems: () => true } });
  await dom.render(Studio);
  await dom.click(button(dom.container, 'editAgain'));
  await dom.text(dom.container.querySelector('textarea'), 'new changes');
  await React.act(async () => release({ submission: { snapshot } }));
  assert.equal(dom.container.querySelector('textarea').value, 'new changes');
  assert.ok(dom.container.querySelector('.jz-error').textContent.includes('editDraftChanged'));
  await dom.click(button(dom.container, 'editAgain'));
  await dom.unmount();
  await React.act(async () => release({ submission: { snapshot } }));
  assert.equal(host.calls.some(({ action }) => ['prepare', 'generate'].includes(action)), false);
});

test('a missing complete snapshot reports the error and preserves the current draft', async (t) => {
  const dom = await createDom(t); timers(t, dom.window); const host = fakeHost();
  const call = (action, payload) => action === 'submission' ? Promise.resolve({ submission: { snapshotAvailable: false } }) : host.call(action, payload);
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [{ id: 'old', submissionId: 'old', snapshotAvailable: true, type: 'image', status: 'failed', prompt: 'incomplete' }], saveItems: () => true } });
  await dom.render(Studio); await dom.text(dom.container.querySelector('textarea'), 'keep this');
  await dom.click(button(dom.container, 'editAgain'));
  assert.equal(dom.container.querySelector('textarea').value, 'keep this');
  assert.ok(dom.container.querySelector('.jz-error').textContent.includes('editSnapshotFailed'));
  assert.equal(host.calls.some(({ action }) => ['prepare', 'generate'].includes(action)), false);
});

test('clearing filtered finished works preserves hidden works and pending task tracking', async (t) => {
  const dom = await createDom(t); const clock = timers(t, dom.window); const host = fakeHost(); const saved = [];
  const works = [{ id: 'shown', type: 'image', model: image.id, status: 'succeeded', prompt: 'image' },
    { id: 'hidden', type: 'video', model: video.id, status: 'succeeded', prompt: 'video' },
    { id: 'pending', type: 'image', model: image.id, status: 'submission_unknown', submissionId: 'pending', recoveryRequired: true }];
  const Studio = createStudio(React, { locale, call: host.call, storage: { loadItems: () => works, saveItems: (items) => { saved.push(structuredClone(items)); return true; } } });
  await dom.render(Studio);
  await dom.click(menuButton(dom.container, 'filterType')); await dom.click(button(dom.container, 'kindImage'));
  await dom.click(button(dom.container, 'clearVisibleFinished (1)'));
  await dom.click(button(dom.container, 'resetFilters'));
  await clock.flush(300);
  assert.deepEqual(saved.at(-1).map((item) => item.id), ['hidden', 'pending']);
  assert.equal(dom.container.querySelectorAll('article').length, 2);
  assert.equal(clock.intervals.size, 1);
});
