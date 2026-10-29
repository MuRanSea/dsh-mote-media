import { createServer } from 'node:http';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const html = (request) => {
  const query = new URL(request.url, 'http://local.preview').searchParams;
  if (query.has('compact')) return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>mote 窄窗口预览</title><style>body{margin:0;background:#e9edf1;font:12px system-ui;color:#586471}header{height:42px;display:grid;place-items:center}iframe{display:block;width:390px;height:660px;border:0;margin:0 auto;box-shadow:0 10px 40px #0002;border-radius:14px}</style><header>本地视觉预览 · 390 px 窄窗口 · 模拟数据</header><iframe title="mote 创作台窄窗口" src="/?embed=1${query.has('empty') ? '&empty=1' : ''}${query.has('chat') ? '&chat=1' : ''}"></iframe></html>`;
  if (query.has('chat')) return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mote 聊天图片卡片 · 隔离预览</title><style>body{margin:0;background:#f9f9fa;color:#303436;font:14px system-ui;line-height:1.55}#app{max-width:720px;margin:32px auto;padding:0 16px}h1{font-size:13px;font-weight:500;color:#899393;margin:0 0 28px}.preview-user{text-align:right;margin:0 0 24px}.preview-user span{display:inline-block;border-radius:15px;background:#edf0ef;padding:12px 18px}.preview-response{padding:14px 2px;color:#65716c}.preview-state{font-size:11px;opacity:.55;margin-top:20px}</style><main id="app"></main><script src="/app.js?chat=1"></script></html>`;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>mote 创作台 · UI 预览</title><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{display:flex;background:#f5f6f8;font:13px system-ui;color:#475464}.preview-sidebar{width:220px;box-sizing:border-box;padding:28px 20px;flex:none}.preview-sidebar strong{font-size:17px;color:#293746}.preview-sidebar p{margin:30px 0 8px}.preview-sidebar span{display:block;padding:12px;border-radius:8px;background:#e7ebee;color:#344453}#app{flex:1;min-width:0;height:100%;position:relative}.preview-note{position:fixed;right:16px;bottom:12px;font-size:10px;color:#8e9ba8;z-index:200;pointer-events:none;background:#18202cbf;padding:5px 9px;border-radius:6px}${query.has('embed') ? '.preview-sidebar{display:none}' : ''}</style><aside class="preview-sidebar"><strong>DeepSeek Harness</strong><p>创作工具</p><span>✧ mote 创作台</span></aside><main id="app"></main><div class="preview-note">本地界面预览 · 模拟数据 · 不调用真实生成</div><script src="/app.js"></script></html>`;
};
const server = createServer(async (request, response) => {
  try {
    response.setHeader('cache-control', 'no-store');
    const url = new URL(request.url, 'http://local.preview');
    if (url.pathname === '/app.js') {
      const result = await build({ absWorkingDir: root, entryPoints: [url.searchParams.has('chat') ? 'tests/visual/chat-preview.js' : 'tests/visual/studio-preview.js'], bundle: true, write: false, platform: 'browser', format: 'iife', target: 'es2020', charset: 'utf8', define: { 'process.env.NODE_ENV': '"production"' } });
      response.setHeader('content-type', 'text/javascript; charset=utf-8');
      response.end(result.outputFiles[0].text); return;
    }
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return; }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(html(request));
  } catch (error) { response.writeHead(500); response.end(error.message); }
});
server.listen(Number(process.env.PORT || 0), '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${server.address().port}`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.stdin.on('data', (data) => { if (data.includes(3)) stop(); });
process.stdin.resume();
