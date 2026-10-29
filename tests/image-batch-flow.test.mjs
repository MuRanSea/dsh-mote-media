import assert from 'node:assert/strict';
import test from 'node:test';
import { React, createDom, button, menuButton } from './support/dom.mjs';
import { createStudio } from '../src/client/app/Studio.js';
import { createTestHost } from './support/host.mjs';
import { createFakeUpstream } from './support/upstream.mjs';

const singleModel = { id: 'single-only-image', type: 'image', parameters: {
  n: { type: 'integer', minimum: 1, maximum: 1, default: 1 },
}, references: [] };
const locale = { t: key => key, getIdeas: () => [] };

test('choosing three images on a single-image model dispatches three durable independent tasks', async t => {
  const dom = await createDom(t);
  t.mock.method(dom.window, 'setInterval', () => 1);
  t.mock.method(dom.window, 'clearInterval', () => {});
  let posted = 0;
  const fake = await createFakeUpstream(t, ({ path, body }) => {
    if (path.endsWith('/models')) return { data: { data: [singleModel] } };
    if (path.endsWith('/images/generations')) {
      posted += 1;
      return { data: { id: `independent-${posted}`, type: 'image', model: body.model, status: 'succeeded', artifacts: [
        { kind: 'image', state: 'available', url: `https://images.example.test/${posted}.png` },
      ] } };
    }
    return { status: 404, data: {} };
  });
  const host = await createTestHost(t, { imageModel: singleModel.id, imageChannelId: 'test',
    channels: [{ id: 'test', baseUrl: fake.baseUrl, apiKey: 'fake-key' }] });
  const calls = [];
  let durable = [];
  const call = async (action, payload) => {
    calls.push({ action, payload });
    if (action === 'generate') assert.equal(durable.length, 3, 'all independent recovery records must exist before the first dispatch');
    const { data } = await host.call(action, payload);
    if (!data.ok) throw Object.assign(new Error(data.error.message), data.error);
    return data;
  };
  const Studio = createStudio(React, { locale, call, storage: { loadItems: () => [],
    saveItems: rows => { durable = structuredClone(rows); return true; },
  } });
  await dom.render(Studio);
  // Initial catalog reads cross an HTTP seam; let that publication reach React.
  for (let attempt = 0; attempt < 30 && !menuButton(dom.container, 'countLabel'); attempt += 1) {
    await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
  assert.ok(menuButton(dom.container, 'countLabel'), 'a single-image provider still supports multiple independent requests');
  await dom.text(dom.container.querySelector('textarea'), 'Independent landscape variations');
  await dom.click(menuButton(dom.container, 'countLabel'));
  await dom.click(button(dom.container, '3countSuffix'));
  await dom.click(dom.container.querySelector('.jz-send'));
  for (let attempt = 0; attempt < 100 && (durable.filter(row => row.status === 'succeeded').length < 3 || dom.container.querySelector('.jz-send').disabled); attempt += 1) {
    await React.act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
  const posts = fake.requests.filter(row => row.path.endsWith('/images/generations'));
  assert.equal(posts.length, 3);
  assert.ok(posts.every(row => row.body.n === 1 && row.body.prompt === 'Independent landscape variations'));
  assert.ok(posts.every(row => !('sequential_image_generation' in row.body)));
  assert.equal(new Set(posts.map(row => row.headers['idempotency-key'])).size, 3);
  const prepares = calls.filter(row => row.action === 'prepare');
  assert.equal(new Set(prepares.map(row => row.payload.submissionId)).size, 3);
  assert.ok(prepares.every(row => row.payload.snapshot.params.n === 1));
  assert.equal(dom.container.querySelectorAll('article').length, 3);
  assert.equal(menuButton(dom.container, 'countLabel').getAttribute('aria-label').includes('3countSuffix'), true);
});
