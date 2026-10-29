import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createMediaToolRow } from '../../src/client/features/chat/MediaToolRow.js';
import { createStudioLocale } from '../../src/client/i18n.js';

const scene = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="800" viewBox="0 0 560 800"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#d1d9ce"/></linearGradient></defs><rect width="560" height="800" fill="url(#s)"/><circle cx="420" cy="215" r="54" fill="#f6f0da"/><path d="M0 510 150 340 370 570 510 425 560 490V800H0" fill="#6d8a87"/><path d="M0 610 185 470 560 660V800H0" fill="#4f6d6c"/><path d="M0 700Q200 610 560 720V800H0" fill="#b2c8bd"/><text x="48" y="110" font-size="32" letter-spacing="6" fill="#eef0e7" font-family="sans-serif">山间清晨</text><text x="50" y="145" font-size="12" letter-spacing="4" fill="#e8efea" font-family="sans-serif">MORNING IN THE MOUNTAINS</text></svg>`)}`;
const complete = { submissionId: 'preview-chat', state: 'accepted', channelId: 'mote',
  task: { id: 'preview-task', type: 'image', model: 'doubao-seedream-5-0-pro-260628', status: 'succeeded', artifacts: ['#8aaca4', '#93a6b4'].map(color => ({ kind: 'image', state: 'available', url: scene(color) })) },
  creation: { originalPrompt: '帮我做两张山间清晨的手机壁纸，清爽一点，上面写“山间清晨”。',
    prompt: '竖版手机壁纸，以薄雾中的山谷为主体。远处山脊、中景树林和近处湖面形成简洁层次，清晨暖光从右上方照入。使用低饱和青绿色和柔和米白色，留出顶部安全区。画面文字逐字为“山间清晨”，排版疏朗，避免多余文案与水印。',
    params: { aspect_ratio: '9:16', resolution: '2K', n: 2 } }, saved: [],
};
const state = new URLSearchParams(window.location.search).get('state');
const value = state === 'unknown' ? { ...complete, state: 'unknown', task: null }
  : state === 'pending' ? { ...complete, task: { ...complete.task, status: 'running', artifacts: [] } }
  : state === 'failed-download' ? { ...complete, saved: [{ artifactIndex: 0, path: 'preview.png', error: 'HTTP 403（模拟保存失败）' }] } : complete;
const locale = createStudioLocale();
locale.register({ get: () => undefined });
const Row = createMediaToolRow(React, { t: locale.t, call: async (action) => {
  if (action === 'submission') return { submission: { ...complete, id: complete.submissionId, source: 'chat', kind: 'image' } };
  if (action === 'download') return { saved: [], task: complete.task };
  throw new Error('隔离预览不调用真实渠道');
} });
createRoot(document.getElementById('app')).render(React.createElement(React.Fragment, null,
  React.createElement('h1', null, '聊天图片卡片 · 模拟数据 · 不调用真实生成'),
  React.createElement('div', { className: 'preview-user' }, React.createElement('span', null, complete.creation.originalPrompt)),
  React.createElement(Row, { toolName: 'mote_image', callId: 'preview-call', phase: 'result', block: { name: 'mote_image', kind: 'tool-result', argsRaw: '{}', isError: false, content: [{ type: 'text', text: JSON.stringify(value) }] } }),
  React.createElement('div', { className: 'preview-response' }, '按手机壁纸用途选择了 9:16、2K，并补充了构图、光线和文字排版。'),
  React.createElement('p', { className: 'preview-state' }, '示意素材用于检查布局；实际参数取决于已配置渠道的模型目录。')));
