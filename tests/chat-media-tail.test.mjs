import assert from 'node:assert/strict';
import test from 'node:test';
import { React, createDom } from './support/dom.mjs';
import { createClientPlugin } from '../src/client/plugin.js';

const image = (id = 'receipt-1', taskId = 'task-1') => ({
  submissionId: id, state: 'accepted',
  task: { id: taskId, type: 'image', status: 'succeeded', artifacts: [
    { kind: 'image', state: 'available', url: `data:image/png;base64,${taskId}` },
  ] },
});
const result = (value, { name = 'mote_image', callId = 'call-1', seq = 10, subCalls = [] } = {}) => ({
  kind: 'tool-result', name, callId, seq, subCalls, isError: false,
  call: { name, argsRaw: '{"prompt":"Original request"}' },
  content: [{ type: 'text', text: JSON.stringify(value) }],
});
function observable(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    getSnapshot: () => value,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(next) { value = next; for (const listener of listeners) listener(); },
    get observed() { return listeners.size; },
  };
}
function pluginViews() {
  const entries = [];
  createClientPlugin(React).apply({ get: () => undefined, slots: {
    inject: (_name, callback) => callback(),
    register: (options, render) => entries.push({ options, render }),
  } });
  const tail = entries.find(({ options }) => options.name === 'conversation.chat.turnTail');
  assert.ok(tail, 'generated images need a completed-Turn contribution outside folded tool activity');
  return { Tail: tail.render, Row: entries.find(({ options }) => options.key === 'mote_image').render };
}
function chatProps(sources, turn = 1) {
  const queries = [];
  const nodes = { turnDataSource: (owner, kind) => { queries.push([owner, kind]); return sources.get(owner); } };
  return { turn: { turn }, seq: 99, useChat: select => select({ nodes }), queries };
}

test('completed chat flattens independent image results and deduplicates recovery by each child receipt', async t => {
  const dom = await createDom(t);
  const { Tail } = pluginViews();
  const children = [image('first', 'first-task'), image('second', 'second-task')];
  const batch = result({ results: children });
  const recovered = result({ ...children[1], creation: { prompt: 'recovered second child' } }, { name: 'mote_media_task', callId: 'recovery', seq: 30 });
  const source = observable([{ root: batch }, { root: recovered }]);
  await dom.render(Tail, chatProps(new Map([[1, source]])));
  assert.equal(dom.container.querySelectorAll('img').length, 2);
  assert.match(dom.container.textContent, /recovered second child/);
  assert.equal([...dom.container.querySelectorAll('.mm-chat')].filter(row => row.textContent.includes('Original request')).length, 1);
  await React.act(async () => source.set([{ root: { ...batch, content: [{ type: 'text', text: 'Output replaced' }], meta: { moteMedia: { results: children } } } }]));
  assert.equal(dom.container.querySelectorAll('img').length, 0);
});

test('completed chat keeps the image outside its closed process details when replayed', async t => {
  const dom = await createDom(t);
  const { Tail, Row } = pluginViews();
  const block = result(image());
  const source = observable([{ root: block }]);
  const props = chatProps(new Map([[1, source]]));
  function CompletedTurn() {
    return React.createElement(React.Fragment, null,
      React.createElement('details', { 'data-process': true },
        React.createElement('summary', null, '已调用工具并读取图片'),
        React.createElement(Row, { phase: 'result', toolName: block.name, block })),
      React.createElement('p', null, '横版风景图已经生成。'),
      React.createElement(Tail, props));
  }
  await dom.render(CompletedTurn);
  assert.equal(dom.container.querySelector('[data-process]').open, false);
  const visibleImages = [...dom.container.querySelectorAll('img')].filter(img => !img.closest('[data-process]'));
  assert.equal(visibleImages.length, 1, 'the completed result remains visible without opening process details');
  assert.deepEqual(props.queries, [[1, 'tool-call']]);
  assert.equal(source.observed, 1);
  await dom.unmount();
  assert.equal(source.observed, 0);
});

test('tail follows canonical hidden and nested results, deduplicating the latest receipt', async t => {
  const dom = await createDom(t);
  const { Tail } = pluginViews();
  const original = result(image());
  const recovery = result({ ...image(), creation: { prompt: 'Latest actual prompt' } }, { name: 'mote_media_task', callId: 'query', seq: 30 });
  const nested = result({}, { name: 'other_tool', callId: 'wrapper', seq: 40, subCalls: [recovery] });
  const unrelated = result(image('other', 'other-task'), { name: 'read_image', callId: 'other', seq: 50 });
  const source = observable([{ root: nested }, { root: unrelated }, { root: original }]);
  await dom.render(Tail, chatProps(new Map([[1, source]])));
  assert.equal(dom.container.querySelectorAll('img').length, 1);
  assert.match(dom.container.textContent, /Latest actual prompt/);
  assert.equal(dom.container.textContent.includes('Original request'), false);
  const second = result(image('receipt-2', 'task-2'), { callId: 'second', seq: 60 });
  await React.act(async () => source.set([{ root: original }, { root: nested }, { root: second }]));
  assert.equal(dom.container.querySelectorAll('img').length, 2);
});

test('tail drops replaced or invalid content and switches Turn subscriptions without leaking images', async t => {
  const dom = await createDom(t);
  const { Tail } = pluginViews();
  const block = result(image());
  const first = observable([{ root: block }]);
  const second = observable([]);
  const props = chatProps(new Map([[1, first], [2, second]]));
  await dom.render(Tail, props);
  assert.equal(dom.container.querySelectorAll('img').length, 1);
  await React.act(async () => first.set([{ root: { ...block,
    content: [{ type: 'text', text: 'Output replaced by policy' }], meta: { moteMedia: image() },
  } }]));
  assert.equal(dom.container.querySelectorAll('img').length, 0);
  await React.act(async () => first.set([{ root: block }]));
  await dom.render(Tail, { ...props, turn: { turn: 2 } });
  assert.equal(dom.container.querySelectorAll('img').length, 0);
  assert.equal(first.observed, 0);
  assert.equal(second.observed, 1);
  await React.act(async () => second.set([{ root: result({ ...image(), task: { ...image().task, type: 'video' } }) }]));
  assert.equal(dom.container.querySelectorAll('img').length, 0);
});
