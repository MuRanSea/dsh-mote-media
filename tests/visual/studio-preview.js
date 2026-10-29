import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createStudio } from '../../src/client/app/Studio.js';
import { createStudioLocale } from '../../src/client/i18n.js';

// Isolated visual fixture: no Host requests, credentials or real generation.
const illustration = (width, height, theme) => {
  const scenes = {
    mountain: `<rect width="100%" height="100%" fill="#bed0d9"/><circle cx="${width * .75}" cy="${height * .25}" r="${width * .12}" fill="#edf1e9"/><path d="M0 ${height * .7}L${width * .35} ${height * .27} ${width * .7} ${height * .72} ${width} ${height * .42}V${height}H0Z" fill="#718c98"/><path d="M0 ${height * .84}L${width * .3} ${height * .58} ${width * .6} ${height * .8} ${width} ${height * .65}V${height}H0Z" fill="#405d6b"/><path d="M0 ${height * .86}Q${width * .5} ${height * .7} ${width} ${height * .88}V${height}H0Z" fill="#b8ccc9"/>`,
    portrait: `<rect width="100%" height="100%" fill="#d3c5b8"/><rect x="${width * .12}" y="${height * .12}" width="${width * .76}" height="${height * .9}" rx="${width * .38}" fill="#b3a695"/><ellipse cx="${width * .5}" cy="${height * .37}" rx="${width * .19}" ry="${height * .17}" fill="#655e57"/><path d="M${width * .08} ${height}Q${width * .04} ${height * .57} ${width * .5} ${height * .55}Q${width * .96} ${height * .57} ${width * .92} ${height}" fill="#373e40"/><path d="M${width * .4} ${height * .34}Q${width * .43} ${height * .47} ${width * .6} ${height * .43}" fill="none" stroke="#a89a87" stroke-width="${width * .026}"/>`,
    product: `<rect width="100%" height="100%" fill="#cad5c9"/><ellipse cx="${width * .54}" cy="${height * .78}" rx="${width * .33}" ry="${height * .065}" fill="#a5b3a5"/><rect x="${width * .23}" y="${height * .6}" width="${width * .54}" height="${height * .17}" rx="${width * .02}" fill="#e6e7d9"/><circle cx="${width * .5}" cy="${height * .42}" r="${width * .21}" fill="#738d81"/><ellipse cx="${width * .44}" cy="${height * .35}" rx="${width * .09}" ry="${height * .045}" fill="#a4b9aa"/>`,
    poster: `<rect width="100%" height="100%" fill="#a69ec0"/><circle cx="${width * .7}" cy="${height * .5}" r="${height * .33}" fill="#ddd9e7"/><path d="M${width * .3} ${height}V${height * .3}Q${width * .3} 0 ${width * .53} ${height * .12}V${height}" fill="#6d6989"/><path d="M${width * .1} ${height}V${height * .62}Q${width * .2} ${height * .3} ${width * .35} ${height * .62}V${height}" fill="#d0c5d3"/>`,
  };
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${scenes[theme]}</svg>`)}`;
};
const image = { id: 'doubao-seedream-5-0-pro-260628', channelId: 'mote', channelName: 'mote', parameters: {
  aspect_ratio: { enum: ['1:1', '16:9', '9:16', '3:4'], default: '1:1' }, resolution: { enum: ['2K', '4K'], default: '2K' }, n: { minimum: 1, maximum: 4, default: 2 },
}, references: [{ role: 'reference', types: ['image'], max_count: 4 }] };
const video = { id: 'doubao-seedance-2-0-fast-260128', channelId: 'mote', channelName: 'mote', parameters: {
  duration: { minimum: 3, maximum: 10, default: 5 }, resolution: { enum: ['720p', '1080p'], default: '720p' }, generate_audio: { default: false },
}, references: [{ role: 'first_frame', types: ['image'], max_count: 1 }, { role: 'last_frame', types: ['image'], max_count: 1 }] };
const catalog = { image: [image, { ...image, id: 'gpt-image-2', channelId: 'studio', channelName: '备用渠道', references: [] }], video: [video] };
if (new URLSearchParams(window.location.search).get('models') === 'long') {
  catalog.image = [image,
    ...['doubao-seedream-5-0-260128', 'doubao-seedream-5-0-lite-260128'].map((id) => ({ ...image, id })),
    ...['nano-banana-2', 'nano-banana', 'nano-banana-pro', 'nano-banana-2-lite', ...Array.from({ length: 16 }, (_, index) => `preview-image-model-with-a-long-identifier-${index + 1}`)].map((id) => ({ ...image, id, channelId: 'local-mote', channelName: 'local-mote' })),
  ];
}
const now = new Date('2026-10-28T10:00:00Z').getTime();
const work = (id, theme, width, height, prompt, params = {}) => ({
  id, submissionId: id, snapshotAvailable: true, type: 'image', status: 'succeeded', model: image.id, channelId: 'mote', prompt,
  params: { resolution: '2K', n: 1, ...params }, createdAt: now, billing: { amount: '0.220000', currency: 'CNY' },
  artifacts: [{ state: 'available', kind: 'image', url: illustration(width, height, theme) }],
});
let items = new URLSearchParams(window.location.search).has('empty') ? [] : [
  work('portrait', 'portrait', 600, 800, '柔和的侧光，人像与建筑轮廓交织，低饱和胶片质感。', { aspect_ratio: '3:4' }),
  work('landscape', 'mountain', 1000, 600, '清晨的山谷与湖面，薄雾、冷色调，远处透出温暖的光。', { aspect_ratio: '16:9' }),
  work('product', 'product', 800, 800, '自然光下的绿色陶瓷，简洁构图，柔和阴影，产品摄影。', { aspect_ratio: '1:1' }),
  work('poster', 'poster', 1000, 650, '以拱门和圆形构建建筑海报，雾紫色、石材与柔和光线。', { aspect_ratio: '16:9' }),
  { id: 'running', submissionId: 'running', snapshotAvailable: true, type: 'video', model: video.id, channelId: 'mote', status: 'running', progress: 54, prompt: '镜头缓缓掠过山间的水面。', params: { duration: 5, resolution: '720p' }, createdAt: now },
  { id: 'unknown', submissionId: 'unknown', snapshotAvailable: true, type: 'image', model: image.id, channelId: 'mote', status: 'submission_unknown', recoveryRequired: true, prompt: '待核实的示例任务', createdAt: now },
  { id: 'failed', submissionId: 'failed', snapshotAvailable: true, type: 'image', model: image.id, channelId: 'mote', status: 'failed', error: { message: '参考素材暂时无法读取，请检查素材后重新生成。' }, prompt: '示例失败任务', createdAt: now },
];
const snapshots = new Map();
const submission = (item) => ({ id: item.submissionId, kind: item.type, channelId: item.channelId, model: item.model,
  state: item.status === 'submission_unknown' ? 'unknown' : item.status === 'failed' ? 'failed' : 'accepted', snapshotAvailable: true,
  task: ['submission_unknown', 'failed'].includes(item.status) ? null : { id: item.id, type: item.type, model: item.model, status: item.status, progress: item.progress, artifacts: item.artifacts, billing: item.billing },
  snapshot: { kind: item.type, channelId: item.channelId, model: item.model, prompt: item.prompt, params: item.params || {}, references: [] }, error: item.error,
});
async function call(action, input = {}) {
  if (action === 'state') return { configured: true, imageModel: image.id, videoModel: video.id, imageChannelId: 'mote', videoChannelId: 'mote', channels: [{ id: 'mote', name: 'mote', driver: 'mote', baseUrl: 'https://example.invalid', configured: true, models: [image.id, video.id] }] };
  if (action === 'models') return { models: catalog[input.category] || catalog.image.concat(catalog.video) };
  if (action === 'chat_works') return { submissions: [] };
  if (action === 'prepare') { snapshots.set(input.submissionId, input.snapshot); return { submission: { id: input.submissionId, state: 'prepared', snapshotAvailable: true } }; }
  if (action === 'generate') {
    const snapshot = snapshots.get(input.submissionId);
    const created = { ...work(input.submissionId, 'mountain', 1000, 600, snapshot.prompt), model: snapshot.model, channelId: snapshot.channelId, type: snapshot.kind };
    if (snapshot.kind === 'video') { created.status = 'queued'; created.artifacts = []; }
    return { submission: { ...submission(created), snapshot }, task: submission(created).task };
  }
  if (action === 'submission') { const item = items.find((item) => item.submissionId === input.submissionId); return { submission: submission(item) }; }
  if (action === 'submissions') return { submissions: input.ids.map((id) => { const item = items.find((item) => item.submissionId === id); return item ? { id, submission: submission(item) } : { id, error: { message: '仅预览示例数据' } }; }) };
  if (action === 'download') return { dir: '本地界面预览（未写入文件）', saved: [{ path: 'preview.png' }] };
  if (action === 'probe') return { image: [image.id], video: [video.id], models: [image, video] };
  throw new Error('本地视觉预览不连接真实渠道。');
}
const locale = createStudioLocale();
locale.register({ get: () => undefined });
const Studio = createStudio(React, { locale, call, storage: { loadItems: () => items, saveItems: (value) => { items = value; return true; } } });
createRoot(document.getElementById('app')).render(React.createElement(Studio));
