import * as React from 'react';
import { JSDOM } from 'jsdom';

export { React };

/** Real React roots in a DOM that never loads remote resources. */
export async function createDom(t) {
  const dom = new JSDOM('<!doctype html><html lang="en"><body><main></main></body></html>', {
    url: 'https://studio.example.test/', pretendToBeVisual: true,
  });
  const previous = new Map();
  for (const [name, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, FileReader: dom.window.FileReader,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  const { createRoot } = await import('react-dom/client');
  const container = dom.window.document.querySelector('main');
  const root = createRoot(container);
  let unmounted = false;
  const unmount = async () => {
    if (unmounted) return;
    await React.act(async () => root.unmount());
    unmounted = true;
  };
  t.after(async () => {
    try {
      await unmount();
    } finally {
      dom.window.close();
      for (const [name, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete globalThis[name];
      }
    }
  });
  return {
    window: dom.window, container, unmount,
    async render(Component, props = {}) {
      await React.act(async () => root.render(React.createElement(Component, props)));
    },
    async click(element) {
      if (!element) throw new Error('Missing element to click');
      await React.act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    },
    async text(element, value) {
      const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      await React.act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    },
  };
}

export function button(container, text) {
  const found = [...container.querySelectorAll('button')].find((element) => element.textContent === text);
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}

export function menuButton(container, label) {
  return [...container.querySelectorAll('button[aria-haspopup="menu"]')].find((element) => element.getAttribute('aria-label')?.startsWith(`${label} `));
}
