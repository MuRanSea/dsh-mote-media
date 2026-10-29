import assert from 'node:assert/strict';
import test from 'node:test';
import { React, createDom, button } from './support/dom.mjs';
import { createMediaToolRow } from '../src/client/features/chat/MediaToolRow.js';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const value = { submissionId: 'chat-1', state: 'accepted', channelId: 'test',
  task: { id: 'task-1', type: 'image', model: 'image-model', status: 'succeeded', artifacts: [
    { kind: 'image', state: 'available', url: png }, { kind: 'image', state: 'available', url: png },
  ] },
  creation: { originalPrompt: '做一个手机壁纸', prompt: '简洁的竖向构图，薄雾山谷，顶部留白。', params: { aspect_ratio: '9:16', resolution: '2K', n: 2 } },
  saved: [{ artifactIndex: 0, path: 'C:\\Pictures\\first.png', url: '/api/mote-media/asset?path=first.png' }],
};
const propsFor = (result) => ({ toolName: 'mote_image', callId: 'call-1', phase: 'result', block: {
  name: 'mote_image', kind: 'tool-result', argsRaw: '{}', isError: false, content: [{ type: 'text', text: JSON.stringify(result) }],
} });
const t = key => key;

test('a batch result renders independent cards and queries only the selected child receipt', async testContext => {
  const dom = await createDom(testContext);
  const calls = [];
  const Row = createMediaToolRow(React, { t, call: async (action, payload) => {
    calls.push({ action, payload });
    return { submission: { ...value, id: payload.submissionId, state: 'accepted' } };
  } });
  const ready = { ...value, task: { ...value.task, artifacts: value.task.artifacts.slice(0, 1) } };
  const pending = { ...value, submissionId: 'chat-2', task: { ...value.task, id: 'task-2', status: 'queued', artifacts: [] }, saved: [] };
  await dom.render(Row, propsFor({ results: [ready, pending] }));
  assert.equal(dom.container.querySelectorAll('.mm-chat').length, 2);
  assert.equal(dom.container.querySelectorAll('img').length, 1);
  await dom.click(button(dom.container, 'chatCheckStatus'));
  assert.deepEqual(calls, [{ action: 'submission', payload: { submissionId: 'chat-2' } }]);
  assert.equal(dom.container.querySelectorAll('img').length, 3);
  const replaced = propsFor({ results: [ready, pending] });
  replaced.block.meta = { moteMedia: { version: 1, results: [ready, pending] } };
  replaced.block.content = [{ type: 'text', text: 'Output replaced' }];
  await dom.render(Row, replaced);
  assert.equal(dom.container.querySelectorAll('img').length, 0);
  assert.match(dom.container.textContent, /Output replaced/);
});

test('a replayed chat result shows multiple images, actual settings and both prompts without running tools', async (testContext) => {
  const dom = await createDom(testContext);
  const calls = [];
  const opened = [];
  const Row = createMediaToolRow(React, { t, call: async (...args) => calls.push(args) });
  await dom.render(Row, { ...propsFor(value), openFile: path => opened.push(path) });
  const images = [...dom.container.querySelectorAll('img')];
  assert.equal(images.length, 2);
  assert.equal(images[0].getAttribute('src'), '/api/mote-media/asset?path=first.png');
  assert.match(dom.container.textContent, /9:16/);
  assert.match(dom.container.textContent, /2K/);
  assert.match(dom.container.textContent, /做一个手机壁纸/);
  assert.match(dom.container.textContent, /薄雾山谷/);
  assert.equal(calls.length, 0);
  await dom.click(button(dom.container, 'chatOpenFile'));
  assert.deepEqual(opened, ['C:\\Pictures\\first.png']);
  await dom.click(dom.container.querySelector('.mm-chat-image'));
  assert.ok(dom.container.querySelector('[role="dialog"][aria-modal="true"]'));
  await React.act(async () => dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(dom.container.querySelector('[role="dialog"]'), null);
});

test('querying an existing chat card changes its status and previews without generating', async (testContext) => {
  const dom = await createDom(testContext);
  const calls = [];
  const Row = createMediaToolRow(React, { t, call: async (action, payload) => {
    calls.push({ action, payload });
    return { submission: { ...value, id: value.submissionId, state: 'accepted', kind: 'image' } };
  } });
  const pending = { ...value, task: { ...value.task, status: 'queued', artifacts: [] }, saved: [] };
  await dom.render(Row, propsFor(pending));
  assert.equal(dom.container.querySelectorAll('img').length, 0);
  await dom.click(button(dom.container, 'chatCheckStatus'));
  assert.equal(dom.container.querySelectorAll('img').length, 2);
  assert.deepEqual(calls, [{ action: 'submission', payload: { submissionId: 'chat-1' } }]);
});

test('download errors retain the successful image and retry only saving the existing receipt', async (testContext) => {
  const dom = await createDom(testContext);
  const calls = [];
  const Row = createMediaToolRow(React, { t, call: async (action, payload) => {
    calls.push({ action, payload });
    return { saved: value.saved, task: value.task };
  } });
  await dom.render(Row, propsFor({ ...value, saved: [{ artifactIndex: 0, path: 'missing.png', error: 'HTTP 403' }] }));
  assert.match(dom.container.textContent, /downloadFailed/);
  assert.equal(dom.container.querySelectorAll('img').length, 2);
  await dom.click(button(dom.container, 'download'));
  assert.deepEqual(calls, [{ action: 'download', payload: { submissionId: 'chat-1' } }]);
  assert.equal(dom.container.textContent.includes('HTTP 403'), false);
});

test('preparing, legacy results and malformed or replaced outputs remain visible', async (testContext) => {
  const dom = await createDom(testContext);
  const Row = createMediaToolRow(React, { t, call: async () => { throw new Error('unexpected request'); } });
  await dom.render(Row, { toolName: 'mote_image', phase: 'preparing', block: { name: 'mote_image', args: { text: key => key === 'prompt' ? 'unfinished prompt' : undefined } } });
  assert.match(dom.container.textContent, /chatPreparing/);
  await dom.render(Row, { ...propsFor({ task: value.task }), block: { ...propsFor({ task: value.task }).block, argsRaw: '{"prompt":"old prompt"}' } });
  assert.equal(dom.container.querySelectorAll('img').length, 2);
  assert.match(dom.container.textContent, /old prompt/);
  const malformed = propsFor(value);
  malformed.block.content = [{ type: 'text', text: 'Output replaced by policy' }];
  malformed.block.meta = { moteMedia: { ...value, version: 1 } };
  await dom.render(Row, malformed);
  assert.equal(dom.container.querySelectorAll('img').length, 0, 'stale metadata must not override replacement content');
  assert.match(dom.container.textContent, /Output replaced by policy/);
  await dom.render(Row, { ...malformed, block: { ...malformed.block, isError: true, content: [{ type: 'text', text: 'Permission denied' }] } });
  assert.match(dom.container.textContent, /Permission denied/);
  await dom.render(Row, propsFor({ submissionId: 'rejected-image', error: 'Unsupported resolution' }));
  assert.match(dom.container.querySelector('.mm-chat-status').textContent, /failed/);
  assert.match(dom.container.textContent, /Unsupported resolution/);
  assert.equal(dom.container.querySelector('button'), null, 'a rejected request must not offer task recovery');
  for (const damaged of [{ task: { status: {} } }, { ...value, creation: { prompt: {} } }, { ...value, task: { ...value.task, type: 'video' } }]) {
    await dom.render(Row, propsFor(damaged));
    assert.equal(dom.container.querySelectorAll('img').length, 0);
    assert.ok(dom.container.querySelector('pre'));
  }
  const withNote = propsFor(value);
  withNote.block.content.push({ type: 'text', text: 'Additional result note' });
  await dom.render(Row, withNote);
  assert.match(dom.container.textContent, /Additional result note/);
});
