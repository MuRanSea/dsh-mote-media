import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createImageWorkflow } from '../src/host/tools/image-workflow.js';
import { createTestHost } from './support/host.mjs';

test('the installed plugin contributes a discoverable image skill and removes it when disabled', async (t) => {
  const registered = new Map();
  const host = await createTestHost(t, {}, { services: { skills: { register(definition) {
    registered.set(definition.name, definition);
    return () => registered.delete(definition.name);
  } } } });
  const skill = registered.get('mote-image');
  assert.ok(skill, 'normal conversations can discover the packaged image skill');
  assert.deepEqual(skill.invocation, { modelInvocable: true, userInvocable: true });
  assert.equal(skill.source, 'bundled');
  assert.ok(skill.description.length > 0);
  assert.equal(skill.resourceBase.kind, 'directory');
  assert.equal((await readFile(skill.path, 'utf8')).includes(skill.content), true);
  assert.ok(skill.content.length > 100);
  assert.equal([...host.tools.keys()].includes('mote_image'), true);
  host.dispose();
  assert.equal(registered.size, 0);
});

test('tool schemas use DSH single types and absent receipt objects stay optional', async (t) => {
  const host = await createTestHost(t);
  function checkSchema(value) {
    if (!value || typeof value !== 'object') return;
    assert.equal(Array.isArray(value.type), false, 'DSH does not support JSON Schema type arrays');
    for (const child of Object.values(value)) checkSchema(child);
  }
  for (const tool of host.tools.values()) {
    checkSchema(tool.parameters);
    checkSchema(tool.output.schema);
  }
  const workflow = createImageWorkflow({}, {
    async get() { return { id: 'unknown-image', state: 'unknown', channelId: 'original', task: null }; },
  });
  const result = await workflow.inspect({ submission_id: 'unknown-image', action: 'status' });
  assert.equal(result.state, 'unknown');
  assert.equal('task' in result, false);
  assert.equal('creation' in result, false);
});
