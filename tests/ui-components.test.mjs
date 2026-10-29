import assert from 'node:assert/strict';
import test from 'node:test';
import { React, createDom, button, menuButton } from './support/dom.mjs';
import { createMenu } from '../src/client/ui/Menu.js';
import { createComposer } from '../src/client/features/composer/Composer.js';
import { createGallery } from '../src/client/features/gallery/Gallery.js';
import { createLightbox } from '../src/client/features/gallery/Lightbox.js';
import { createSettingsDialog } from '../src/client/features/channels/SettingsDialog.js';
import { modelValue } from '../src/client/domain/model-capabilities.js';
import { createStudioLocale } from '../src/client/i18n.js';

const tKey = (key) => key;
const imageModel = {
  id: 'test-image', channelId: 'test', channelName: 'test',
  parameters: { aspect_ratio: { enum: ['1:1', '16:9'], default: '1:1' }, n: { minimum: 1, maximum: 2, default: 1 } },
  references: [{ role: 'reference', types: ['image'], max_count: 2 }],
};

test('image count is independent of provider group limits and selecting it only changes the draft', async t => {
  const dom = await createDom(t);
  dom.window.document.documentElement.lang = 'zh-CN';
  const locale = createStudioLocale();
  locale.register({ get: () => undefined });
  const Composer = createComposer(React, locale.t);
  const seedream = { ...imageModel, driver: 'mote', id: 'doubao-seedream-5-0-lite-260128',
    parameters: { n: { minimum: 1, maximum: 15, default: 1 } } };
  const counts = [];
  const updates = [];
  let submissions = 0;
  const props = { type: 'image', models: { image: [seedream], video: [] }, modelId: seedream.id,
    params: { n: 1 }, imageCount: 1, prompt: '同一人物在四季的场景', refs: [], frames: {},
    onCount: value => counts.push(value),
    onParams: value => updates.push(value), onRun: () => { submissions += 1; },
  };
  await dom.render(Composer, props);
  const control = menuButton(dom.container, '张数');
  assert.ok(control);
  assert.match(control.textContent, /1张/);
  await dom.click(control);
  const choices = [...dom.container.querySelectorAll('[role="menuitemradio"]')];
  assert.equal(choices.length, 15);
  const four = choices.find(node => node.textContent.startsWith('4张'));
  assert.ok(four);
  await dom.click(four);
  assert.deepEqual(counts, [4]);
  assert.deepEqual(updates, [], 'the independent count is not an upstream parameter');
  assert.equal(submissions, 0);
  await dom.render(Composer, { ...props, imageCount: 4 });
  assert.match(menuButton(dom.container, '张数').textContent, /4张/);
  assert.match(dom.container.textContent, /每张图片独立提交/);
  const compatible = { ...seedream, driver: 'openai-images' };
  await dom.render(Composer, { ...props, models: { image: [compatible], video: [] } });
  assert.ok(menuButton(dom.container, '张数'));
  assert.equal(menuButton(dom.container, '组图'), undefined);
  const singleOnly = { ...seedream, parameters: { n: { minimum: 1, maximum: 1, default: 1 } } };
  await dom.render(Composer, { ...props, models: { image: [singleOnly], video: [] } });
  assert.equal(menuButton(dom.container, '组图'), undefined);
  assert.ok(menuButton(dom.container, '张数'), 'single-image models also support independent requests');
});

test('menu retains its state across rerenders, dispatches a choice and cleans up window listeners', async (t) => {
  const dom = await createDom(t);
  const Menu = createMenu(React);
  const picked = [];
  const props = { label: 'type', value: 'Image', current: 'image', items: [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }], onPick: (value) => picked.push(value) };
  const add = t.mock.method(dom.window, 'addEventListener');
  const remove = t.mock.method(dom.window, 'removeEventListener');
  await dom.render(Menu, props);
  await dom.click(dom.container.querySelector('.jz-chip'));
  assert.ok(dom.container.querySelector('.jz-drop'));
  await dom.render(Menu, { ...props, value: 'Updated label' });
  assert.ok(dom.container.querySelector('.jz-drop'), 'rerender must preserve the menu instance');
  await dom.click(button(dom.container, 'Video'));
  assert.deepEqual(picked, ['video']);
  assert.equal(dom.container.querySelector('.jz-drop'), null);
  await dom.click(dom.container.querySelector('.jz-chip'));
  await dom.unmount();
  const tracked = new Set(['pointerdown', 'scroll', 'resize']);
  const registrations = add.mock.calls.filter(({ arguments: args }) => tracked.has(args[0]));
  assert.equal(registrations.length, 6);
  for (const { arguments: args } of registrations) {
    assert.ok(remove.mock.calls.some((call) => args.every((value, index) => call.arguments[index] === value)), `missing ${args[0]} cleanup`);
  }
});

test('composer preserves image upload, ratio selection, size limits and the generate shortcut', async (t) => {
  const dom = await createDom(t);
  const Composer = createComposer(React, tKey);
  const referenceUpdates = [];
  const parameterUpdates = [];
  let generated = 0;
  let uploaded;
  const uploadDone = new Promise((resolve) => { uploaded = resolve; });
  await dom.render(Composer, {
    type: 'image', models: { image: [imageModel], video: [] }, modelId: imageModel.id,
    params: { aspect_ratio: '1:1', n: 1 }, prompt: 'test prompt', refs: [], frames: { first: null, last: null },
    busy: false, error: '', blocked: false,
    onType() {}, onModel() {}, onParams: (params) => parameterUpdates.push(params), onPrompt() {},
    onRefs() {}, onAddReference: (reference) => { referenceUpdates.push([reference]); uploaded(); return ''; }, onFrames() {}, onRun: () => { generated += 1; }, textareaRef: { current: null },
  });
  const file = new dom.window.File([new Uint8Array([1, 2, 3])], 'reference.png', { type: 'image/png' });
  const input = dom.container.querySelector('input[type="file"]');
  await React.act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await uploadDone;
  });
  assert.equal(referenceUpdates[0][0].name, 'reference.png');
  assert.ok(referenceUpdates[0][0].url.startsWith('data:image/png;base64,'));
  await dom.click(menuButton(dom.container, 'ratioLabel'));
  await dom.click(button(dom.container, '16:9'));
  assert.deepEqual(parameterUpdates, [{ aspect_ratio: '16:9', n: 1 }]);
  await React.act(async () => {
    dom.container.querySelector('textarea').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  });
  assert.equal(generated, 1);
  await React.act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [{ size: 2 * 1024 * 1024 + 1 }] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.equal(dom.container.querySelector('.jz-note').textContent, 'uploading');
  assert.equal(referenceUpdates.length, 1);
  await React.act(async () => {
    Object.defineProperty(input, 'files', { configurable: true, value: [new dom.window.File(['clip'], 'clip.mp4', { type: 'video/mp4' })] });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.equal(dom.container.querySelector('.jz-note').textContent, 'referenceImageOnly');
  assert.equal(referenceUpdates.length, 1);
});

test('gallery and preview preserve work identity and their action callbacks', async (t) => {
  const dom = await createDom(t);
  const Gallery = createGallery(React, tKey);
  const work = { id: 'work-1', taskId: 'task-1', model: 'test-image', type: 'image', status: 'succeeded', prompt: 'test prompt',
    artifacts: [{ kind: 'image', state: 'available', url: 'https://cdn.example.test/image.png' }],
  };
  const actions = [];
  const callback = (name) => (item) => actions.push([name, item]);
  await dom.render(Gallery, { items: [work], onClearFinished: () => actions.push(['clear']),
    onPreview: callback('preview'), onDownload: callback('download'), onRemove: callback('remove'), onRetry: callback('retry'),
    onUse: () => ({ label: 'reuse', run: callback('reuse') }),
  });
  assert.equal(dom.container.querySelectorAll('article').length, 1);
  for (const action of ['preview', 'download', 'reuse', 'remove']) await dom.click(dom.container.querySelector(`button[title="${action}"]`));
  assert.deepEqual(actions.map(([name]) => name), ['preview', 'download', 'reuse', 'remove']);
  assert.ok(actions.every(([, item]) => item === work));
  await dom.click(button(dom.container, 'clearFinished (1)'));
  assert.equal(actions.at(-1)[0], 'clear');
  const Lightbox = createLightbox(React, tKey);
  let closed = 0;
  await dom.render(Lightbox, { item: work, onClose: () => { closed += 1; }, onDownload: callback('download'), onRetry: callback('retry'), onCopy: callback('copy') });
  await React.act(async () => dom.container.querySelector('.jz-lightbox').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })));
  assert.equal(closed, 0);
  await dom.click(button(dom.container, 'copyDiag'));
  assert.equal(actions.at(-1)[0], 'copy');
  await React.act(async () => dom.container.querySelector('.jz-overlay').dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true })));
  assert.equal(closed, 1);
});

test('channel dialog probes the configured channel and saves a blank key for the Host to preserve', async (t) => {
  const dom = await createDom(t);
  const calls = [];
  const saved = [];
  let closed = 0;
  const SettingsDialog = createSettingsDialog(React, { t: tKey, call: async (action, payload) => {
    calls.push({ action, payload });
    return { image: ['discovered-image'], video: [], models: [{ id: 'discovered-image' }] };
  } });
  await dom.render(SettingsDialog, { state: { channels: [{ id: 'test', name: 'Test', driver: 'mote', baseUrl: 'https://fake-upstream.test', configured: true, apiKey: 'fake-must-not-appear', models: ['old-image'] }] },
    models: { image: [imageModel], video: [] }, onClose: () => { closed += 1; }, onSave: async (patch) => saved.push(patch), onTest: async () => 1,
  });
  assert.equal(dom.container.querySelector('input[type="password"]').value, '');
  assert.equal(dom.container.innerHTML.includes('fake-must-not-appear'), false);
  await dom.click(button(dom.container, 'autoFetch'));
  assert.equal(calls[0].action, 'probe');
  assert.equal(calls[0].payload.channelId, 'test');
  assert.equal(calls[0].payload.apiKey, '');
  await dom.click(button(dom.container, 'save'));
  assert.deepEqual(saved[0].channels[0].models, ['discovered-image']);
  assert.equal(saved[0].channels[0].apiKey, '');
  assert.equal(saved[0].channels[0].id, 'test');
  assert.equal(closed, 1);
});

test('default model selection preserves the channel when model ids are equal', async (t) => {
  const dom = await createDom(t); const patches = [];
  const SettingsDialog = createSettingsDialog(React, { t: tKey, call: async () => ({}) });
  const a = { ...imageModel, id: 'same-model', channelId: 'a', channelName: 'A' };
  const b = { ...a, channelId: 'b', channelName: 'B' };
  await dom.render(SettingsDialog, { state: { imageModel: a.id, imageChannelId: 'a', channels: [] }, models: { image: [a, b], video: [] }, onClose() {}, onTest() {}, onSave: async (patch) => patches.push(patch) });
  const select = dom.container.querySelector('select');
  assert.equal(select.value, modelValue(a));
  await React.act(async () => { select.value = modelValue(b); select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  await dom.click(button(dom.container, 'save'));
  assert.equal(patches[0].imageModel, 'same-model'); assert.equal(patches[0].imageChannelId, 'b');
});

test('parameter menus support arrow navigation and Escape returns focus to their trigger', async (t) => {
  const dom = await createDom(t); const Menu = createMenu(React);
  await dom.render(Menu, { label: 'type', value: 'Image', current: 'image', items: [{ value: 'image', label: 'Image' }, { value: 'video', label: 'Video' }], onPick() {} });
  const trigger = menuButton(dom.container, 'type');
  await dom.click(trigger);
  assert.equal(dom.window.document.activeElement.getAttribute('aria-checked'), 'true');
  await React.act(async () => dom.window.document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  assert.equal(dom.window.document.activeElement.textContent, 'Video');
  await React.act(async () => dom.window.document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(dom.container.querySelector('[role="menu"]'), null);
  assert.equal(dom.window.document.activeElement, trigger);
});

test('a long model menu opens downward when there is room below and limits its height', async (t) => {
  const dom = await createDom(t); const Menu = createMenu(React);
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 900 });
  const items = Array.from({ length: 40 }, (_, index) => ({ value: `model-${index}`, label: `Model ${index}`, description: `long-model-id-${index}` }));
  await dom.render(Menu, { label: 'Models', value: 'Model 20', current: 'model-20', items, width: 280, searchLabel: 'Search models', emptyLabel: 'No models', onPick() {} });
  const trigger = menuButton(dom.container, 'Models');
  t.mock.method(trigger, 'getBoundingClientRect', () => ({ top: 320, bottom: 352, left: 500, right: 650, width: 150, height: 32 }));
  await dom.click(trigger);
  const popup = dom.container.querySelector('[role="menu"]');
  assert.equal(Number.parseFloat(popup.style.top), 358, 'ample space above must not override the dropdown direction');
  assert.equal(popup.style.bottom, '');
  assert.ok(Number.parseFloat(popup.style.maxHeight) <= 280, 'a long catalog uses a compact scrolling popup');
  assert.equal(dom.container.querySelectorAll('[role="menuitemradio"]').length, 40, 'height limits must not discard choices');
  await dom.click(trigger);
  t.mock.method(trigger, 'getBoundingClientRect', () => ({ top: 710, bottom: 742, left: 500, right: 650, width: 150, height: 32 }));
  await dom.click(trigger);
  const shorter = dom.container.querySelector('[role="menu"]');
  assert.equal(Number.parseFloat(shorter.style.top), 748, 'a usable short dropdown is preferred to covering the composer above');
  assert.ok(Number.parseFloat(shorter.style.maxHeight) <= 140);
});

test('model search filters names, ids and channel groups while preserving keyboard selection and values', async (t) => {
  const dom = await createDom(t); const Menu = createMenu(React); const picked = [];
  const items = [
    { header: true, value: 'a-header', label: 'mote' },
    { value: '["a","seedream"]', label: 'Seedream 5.0', description: 'doubao-seedream-5-0-260128' },
    { value: '["a","same-model"]', label: 'GPT Image', description: 'same-model' },
    { header: true, value: 'b-header', label: 'local-mote' },
    { value: '["b","banana"]', label: 'Nano Banana 2', description: 'nano-banana-2' },
    { value: '["b","same-model"]', label: 'GPT Image', description: 'same-model' },
  ];
  await dom.render(Menu, { label: 'Models', value: 'Seedream 5.0', current: items[1].value, items, searchLabel: 'Search models', emptyLabel: 'No matching models', onPick: (value) => picked.push(value) });
  const trigger = menuButton(dom.container, 'Models');
  await dom.click(trigger);
  const search = dom.container.querySelector('input[type="search"]');
  assert.ok(search, 'large catalogs can be narrowed without expanding the popup');
  assert.equal(dom.window.document.activeElement, search);
  await dom.text(search, 'LOCAL-MOTE same-model');
  assert.equal(dom.container.querySelectorAll('[role="menuitemradio"]').length, 1);
  assert.deepEqual([...dom.container.querySelectorAll('.jz-drop-head')].map((element) => element.textContent), ['local-mote']);
  assert.deepEqual(picked, []);
  await React.act(async () => search.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  assert.equal(dom.window.document.activeElement.textContent, 'GPT Imagesame-model');
  await dom.click(dom.window.document.activeElement);
  assert.deepEqual(picked, ['["b","same-model"]']);
  assert.equal(dom.window.document.activeElement, trigger);
  await dom.click(trigger);
  assert.equal(dom.container.querySelector('input[type="search"]').value, '');
  assert.equal(dom.container.querySelectorAll('[role="menuitemradio"]').length, 4);
  await dom.text(dom.container.querySelector('input[type="search"]'), 'nothing matches');
  assert.equal(dom.container.querySelectorAll('[role="menuitemradio"]').length, 0);
  assert.equal(dom.container.querySelector('[role="status"]').textContent, 'No matching models');
  await React.act(async () => dom.container.querySelector('input[type="search"]').dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(dom.container.querySelector('[role="menu"]'), null);
  assert.equal(dom.window.document.activeElement, trigger);
});

test('a menu near the bottom flips upward within the plugin panel instead of escaping into the host', async (t) => {
  const dom = await createDom(t); const Menu = createMenu(React);
  Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 900 });
  function Panel() { return React.createElement('div', { className: 'jz-root' }, React.createElement(Menu, {
    label: 'Models', value: 'One', current: 'one', width: 280, items: Array.from({ length: 20 }, (_, index) => ({ value: index, label: `Model ${index}` })), onPick() {},
  })); }
  await dom.render(Panel);
  t.mock.method(dom.container.querySelector('.jz-root'), 'getBoundingClientRect', () => ({ top: 100, bottom: 500, left: 240, right: 640, width: 400, height: 400 }));
  const trigger = menuButton(dom.container, 'Models');
  t.mock.method(trigger, 'getBoundingClientRect', () => ({ top: 450, bottom: 482, left: 580, right: 760, width: 180, height: 32 }));
  await dom.click(trigger);
  const popup = dom.container.querySelector('[role="menu"]');
  assert.equal(popup.style.top, '');
  const bottom = 900 - Number.parseFloat(popup.style.bottom);
  assert.ok(bottom <= 444);
  assert.ok(bottom - Number.parseFloat(popup.style.maxHeight) >= 112);
  assert.ok(Number.parseFloat(popup.style.left) >= 240);
  assert.ok(Number.parseFloat(popup.style.left) + Number.parseFloat(popup.style.width) <= 640);
  await React.act(async () => dom.container.querySelector('.jz-drop-list').dispatchEvent(new dom.window.Event('scroll')));
  assert.ok(dom.container.querySelector('[role="menu"]'), 'internal scrolling keeps the menu open');
});

test('work details trap keyboard focus, close with Escape and restore the opener', async (t) => {
  const dom = await createDom(t); const Lightbox = createLightbox(React, tKey);
  const opener = dom.window.document.createElement('button'); dom.window.document.body.appendChild(opener); opener.focus();
  let closed = 0;
  const item = { id: 'work', type: 'image', status: 'succeeded', model: 'test-image', prompt: 'test prompt', params: { aspect_ratio: '9:16', n: 2 }, artifacts: [{ state: 'available', kind: 'image', url: 'https://cdn.test/image.png' }] };
  await dom.render(Lightbox, { item, onClose: () => { closed += 1; }, onDownload() {}, onCopy() {} });
  assert.ok(dom.container.querySelector('[role="dialog"][aria-modal="true"]'));
  assert.equal(dom.window.document.activeElement, dom.container.querySelector('.jz-preview-close'));
  await React.act(async () => dom.window.document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
  assert.equal(dom.window.document.activeElement.textContent, 'close');
  await React.act(async () => dom.window.document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(closed, 1);
  await dom.unmount();
  assert.equal(dom.window.document.activeElement, opener);
  assert.equal(dom.window.document.body.style.overflow, '');
});

test('gallery combines type, status and text filters, keeps updated work identity and clears only visible finished results', async (t) => {
  const dom = await createDom(t); const Gallery = createGallery(React, tKey);
  const works = [
    { id: 'one', type: 'image', status: 'succeeded', model: 'doubao-seedream-5-0-lite-260128', prompt: 'paper boat' },
    { id: 'two', type: 'video', status: 'running', model: 'video-model', prompt: 'paper boat' },
    { id: 'three', type: 'image', status: 'submission_unknown', model: 'image-model', prompt: 'quiet river', submissionId: 'three' },
    { id: 'four', type: 'image', status: 'failed', model: 'image-model', prompt: 'paper boat' },
  ];
  const edits = []; const cleared = [];
  const props = { items: works, onUse: () => null, onEdit: (item) => edits.push(item), onClearFinished: (items) => cleared.push(items) };
  await dom.render(Gallery, props);
  const search = () => dom.container.querySelector('input[type="search"]');
  assert.ok(search(), 'works can be searched through the gallery');
  await dom.text(search(), '  PAPER boat  ');
  assert.equal(dom.container.querySelectorAll('article').length, 3);
  await dom.click(menuButton(dom.container, 'filterType')); await dom.click(button(dom.container, 'kindImage'));
  await dom.click(menuButton(dom.container, 'filterStatus')); await dom.click(button(dom.container, 'failed'));
  assert.equal(dom.container.querySelectorAll('article').length, 1);
  await dom.click(button(dom.container, 'editAgain'));
  assert.equal(edits[0], works[3]);
  await dom.click(button(dom.container, 'clearVisibleFinished (1)'));
  assert.deepEqual(cleared[0], [works[3]]);
  assert.equal(cleared[0][0], works[3]);
  await dom.text(search(), 'missing words');
  assert.ok(dom.container.textContent.includes('noMatchingWorks'));
  assert.equal(dom.container.querySelectorAll('article').length, 0);
  await dom.click(button(dom.container, 'resetFilters'));
  assert.equal(dom.container.querySelectorAll('article').length, 4);
  await dom.text(search(), 'Seedream 5.0');
  assert.equal(dom.container.querySelectorAll('article').length, 1, 'search accepts the displayed model name');
  await dom.click(button(dom.container, 'resetFilters'));
  await dom.click(menuButton(dom.container, 'filterStatus')); await dom.click(button(dom.container, 'submissionUnknown'));
  assert.equal(dom.container.querySelectorAll('article').length, 1);
  const updated = { ...works[2], status: 'succeeded' };
  await dom.render(Gallery, { ...props, items: works.map((item) => item.id === 'three' ? updated : item) });
  assert.equal(dom.container.querySelectorAll('article').length, 0, 'polling updates are reflected without mutating the source list');
  await dom.click(button(dom.container, 'resetFilters'));
  assert.equal(dom.container.querySelectorAll('article').length, 4);
  assert.equal(works[2].status, 'submission_unknown');
});
