import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudioLocale } from '../src/client/i18n.js';

test('locale delegates remain live after binding and stay isolated between plugin instances', () => {
  const chinese = createStudioLocale();
  const english = createStudioLocale();
  const liveTranslate = chinese.t;
  const register = (locale, imageLabel, panelLabel) => {
    const dictionaries = [];
    locale.register({
      effect: (callback) => callback(),
      get: () => ({
        register: (_namespace, language, dictionary) => dictionaries.push({ language, dictionary }),
        bind: () => (key) => key === 'modeImage' ? imageLabel : panelLabel,
      }),
    });
    return dictionaries;
  };
  const zh = register(chinese, '图片生成', '中文创作台');
  const en = register(english, 'Image', 'English Studio');
  assert.equal(liveTranslate('panelLabel'), '中文创作台');
  assert.equal(english.t('panelLabel'), 'English Studio');
  assert.notEqual(zh[0].dictionary, en[0].dictionary, 'each plugin keeps its own dictionaries');
  assert.match(chinese.getIdeas()[0], /白色背景/);
  assert.match(english.getIdeas()[0], /Metal headphones/);
});
