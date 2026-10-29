import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const clientUrl = new URL('../client.js', import.meta.url);

async function loadClient(language = 'zh-CN') {
  const registrations = [];
  const locales = [];
  const requestedModules = [];
  let definition;
  const react = { createElement: (type, props, ...children) => ({ type, props, children }) };
  const context = vm.createContext({
    window: { __ModuleLoader__: { load: (value) => { definition = value; } } },
    document: { documentElement: { lang: language } },
    navigator: { language },
  });
  vm.runInContext(await readFile(clientUrl, 'utf8'), context, { filename: 'client.js' });
  assert.equal(definition.id, '@local/dsh-mote-media');
  const plugin = definition.factory((name) => {
    requestedModules.push(name);
    assert.equal(name, 'react', 'React must come from the DSH module loader');
    return react;
  });
  const ctx = {
    get: () => undefined,
    effect: (effect) => effect(),
    slots: {
      inject: (_slot, callback) => callback(),
      register: (options, render) => registrations.push({ options, render }),
    },
  };
  return { definition, plugin, ctx, registrations, locales, requestedModules };
}

test('client loads as one DSH module and registers its page and sidebar', async () => {
  const client = await loadClient();
  assert.deepEqual(client.requestedModules, ['react']);
  assert.deepEqual(Array.from(client.plugin.inject), ['slots', 'locale']);
  client.plugin.apply(client.ctx);
  const main = client.registrations.find(({ options }) => options.name === 'main');
  const sidebar = client.registrations.find(({ options }) => options.name === 'sidebar.panellist');
  assert.equal(main.options.key, 'mote-media');
  assert.equal(typeof main.render, 'function');
  assert.equal(sidebar.options.id, 'mote-media');
  assert.equal(sidebar.options.label(), 'mote 创作台');
  assert.equal(sidebar.render({ size: 24 }).type, 'svg');
});

test('client registers the existing locale namespace and supported language tags', async () => {
  const client = await loadClient();
  client.ctx.get = (name) => name === 'locale' ? {
    register(namespace, language, dictionary) {
      client.locales.push({ namespace, language, dictionary });
    },
    bind: () => (key) => `translated:${key}`,
  } : undefined;
  client.plugin.apply(client.ctx);
  assert.deepEqual(client.locales.map(({ language }) => language), ['en', 'zh', 'zh-CN']);
  assert.ok(client.locales.every(({ namespace }) => namespace === 'moteMedia'));
  assert.equal(client.locales[0].dictionary.panelLabel, 'mote Studio');
  assert.equal(client.registrations[1].options.label(), 'translated:panelLabel');
});

test('client falls back to the browser language when DSH locale is unavailable', async () => {
  const client = await loadClient('en-US');
  client.plugin.apply(client.ctx);
  assert.equal(client.registrations[1].options.label(), 'mote Studio');
});

test('the client contributes chat media views only for its own image and recovery tools', async () => {
  const client = await loadClient();
  client.plugin.apply(client.ctx);
  const entries = client.registrations.filter(({ options }) => options.name === 'tool.call.toolview');
  assert.deepEqual(entries.map(({ options }) => options.key), ['mote_image', 'mote_media_task']);
  assert.ok(entries.every(({ render }) => typeof render === 'function'));
});
