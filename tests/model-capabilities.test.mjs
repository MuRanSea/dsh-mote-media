import assert from 'node:assert/strict';
import test from 'node:test';
import {
  modelChoices, modelById, defaultParams, paramsForModel, cleanParams,
  ratioToSize, sizeToRatio, referenceRoles, modelValue,
} from '../src/client/domain/model-capabilities.js';

test('model selection stays within the requested image or video catalog', () => {
  const image = { id: 'image-model' };
  const video = { id: 'video-model' };
  const catalog = { image: [image], video: [video] };
  assert.deepEqual(modelChoices(catalog, 'image'), [image]);
  assert.equal(modelById(catalog, 'video', video.id), video);
  assert.equal(modelById(catalog, 'image', video.id), null);
  assert.deepEqual(modelChoices({ image: null }, 'image'), []);
});

test('model defaults and submission parameters preserve false and zero but discard stale fields', () => {
  const model = { parameters: {
    prompt: { default: 'not a parameter' },
    resolution: { default: '2K' }, aspect_ratio: { default: '1:1' },
    seed: { default: 0 }, generate_audio: { default: false }, n: {}, unused: { default: null },
  } };
  assert.deepEqual(defaultParams(model), { resolution: '2K', aspect_ratio: '1:1', seed: 0, generate_audio: false });
  const draft = { size: '1024x1024', aspect_ratio: '16:9', resolution: '', seed: 0, generate_audio: false, n: 2, unknown: 'stale' };
  assert.deepEqual(paramsForModel(model, draft), { aspect_ratio: '16:9', seed: 0, generate_audio: false, n: 2 });
  assert.equal(draft.size, '1024x1024', 'normalization must not mutate the composer draft');
  assert.deepEqual(defaultParams(null), {});
  assert.deepEqual(paramsForModel(null, draft), {});
});

test('size conflicts are resolved consistently for submission and stored parameter snapshots', () => {
  const model = { parameters: { size: {}, aspect_ratio: {}, resolution: {}, seed: {} } };
  const params = { size: '2K', resolution: '2K', aspect_ratio: '1:1', seed: 0, empty: '', omitted: undefined, nil: null };
  assert.deepEqual(paramsForModel(model, params), { size: '2K', seed: 0 });
  assert.deepEqual(cleanParams(params), { size: '2K', seed: 0 });
  assert.deepEqual(cleanParams({ size: '1024x1024', resolution: '2K' }), { size: '1024x1024', resolution: '2K' });
});

test('pixel dimensions map to the existing ratio choices', () => {
  assert.equal(ratioToSize('16:9'), '1536x864');
  assert.equal(ratioToSize('unsupported'), '');
  assert.equal(sizeToRatio('1920 × 1080'), '16:9');
  assert.equal(sizeToRatio('1024x1536'), '2:3');
  for (const size of ['', 'auto', 'invalid', '0x100', null]) assert.equal(sizeToRatio(size), '');
});

test('reference uploads reflect declared image roles and per-role limits', () => {
  const model = { references: [
    { role: 'reference', types: ['image'], max_count: 4 },
    { role: 'first_frame', types: ['image'] },
    { role: 'last_frame', types: ['video'] },
  ] };
  assert.deepEqual(referenceRoles(model), { reference: true, referenceLimit: 4, firstFrame: true, lastFrame: false });
  assert.deepEqual(referenceRoles(null), { reference: false, referenceLimit: 0, firstFrame: false, lastFrame: false });
});

test('same model ids from different channels have distinct selections and ambiguous legacy ids are rejected', () => {
  const a = { id: 'same-model', channelId: 'a' };
  const b = { id: 'same-model', channelId: 'b' };
  const models = { image: [a, b] };
  assert.notEqual(modelValue(a), modelValue(b));
  assert.equal(modelById(models, 'image', modelValue(b)), b);
  assert.equal(modelById(models, 'image', 'same-model'), null);
  assert.equal(modelById(models, 'image', 'same-model', 'a'), a);
});
