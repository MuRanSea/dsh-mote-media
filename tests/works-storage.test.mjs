import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorksStorage } from '../src/client/storage/works-storage.js';

const key = 'mote-media.studio.v1';

function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[key, initial]]);
  return { values, getItem: (name) => values.get(name) ?? null, setItem: (name, value) => values.set(name, value) };
}

test('existing work records load from the unchanged key without losing task details', () => {
  const work = { id: 'work-1', type: 'image', taskId: 'pending-task', status: 'running', params: { seed: 0 }, extra: 'retained' };
  const memory = memoryStorage(JSON.stringify([work, null, {}, { id: 'other', type: 'unsupported' }]));
  const storage = createWorksStorage({ getStorage: () => memory });
  assert.deepEqual(storage.loadItems(), [work]);
  assert.equal(memory.values.size, 1);
});

test('saving retains the first 120 records in order and leaves the in-memory list intact', () => {
  const memory = memoryStorage();
  const storage = createWorksStorage({ getStorage: () => memory });
  const items = Array.from({ length: 125 }, (_, index) => ({ id: `work-${index}`, type: index % 2 ? 'image' : 'video' }));
  storage.saveItems(items);
  assert.equal(items.length, 125);
  assert.deepEqual(storage.loadItems(), items.slice(0, 120));
  assert.deepEqual([...memory.values.keys()], [key]);
});

test('empty, damaged and non-array records use the existing empty fallback', () => {
  for (const value of [undefined, '', 'broken JSON', '{}', 'null', '1']) {
    const memory = memoryStorage(value);
    assert.deepEqual(createWorksStorage({ getStorage: () => memory }).loadItems(), []);
  }
});

test('blocked storage and quota errors remain contained by the storage module', () => {
  let accesses = 0;
  const blocked = createWorksStorage({ getStorage() { accesses += 1; throw new Error('storage blocked'); } });
  assert.equal(accesses, 0, 'constructing the module must not touch browser storage');
  assert.deepEqual(blocked.loadItems(), []);
  assert.doesNotThrow(() => blocked.saveItems([]));
  const quota = createWorksStorage({ getStorage: () => ({ setItem() { throw new Error('quota exceeded'); } }) });
  assert.doesNotThrow(() => quota.saveItems([{ id: 'work', type: 'image' }]));
  assert.equal(quota.saveItems([]), false);
});

test('browser records stay lightweight while the complete snapshot remains on the Host', () => {
  const memory = memoryStorage();
  const storage = createWorksStorage({ getStorage: () => memory });
  assert.equal(storage.saveItems([{ id: 'work', type: 'image', submissionId: 'intent', snapshotAvailable: true, snapshot: { references: ['large-inline-reference'] } }]), true);
  assert.equal(memory.values.get(key).includes('large-inline-reference'), false);
  assert.equal(storage.loadItems()[0].submissionId, 'intent');
});
