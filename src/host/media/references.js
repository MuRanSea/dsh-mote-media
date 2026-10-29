import { sniffMime } from './artifacts.js';
import { messageOf } from '../channels/request.js';

export function toReferences(list) {
  if (!Array.isArray(list)) return undefined;
  const out = [];
  for (const item of list) {
    if (typeof item === 'string' && item.trim() !== '') {
      const value = item.trim();
      out.push(
        value.startsWith('http')
          ? { role: 'reference', type: 'image', url: value }
          : { role: 'reference', type: 'image', file_id: value },
      );
      continue;
    }
    if (item === null || typeof item !== 'object') continue;
    const role = typeof item.role === 'string' ? item.role : 'reference';
    const type = typeof item.type === 'string' ? item.type : 'image';
    const entry = { role, type };
    if (typeof item.url === 'string' && item.url.trim() !== '') entry.url = item.url.trim();
    else if (typeof item.file_id === 'string' && item.file_id.trim() !== '') entry.file_id = item.file_id.trim();
    else if (typeof item.asset_id === 'string' && item.asset_id.trim() !== '') entry.asset_id = item.asset_id.trim();
    else continue;
    out.push(entry);
  }
  return out.length > 0 ? out : undefined;
}

export function isNonPublicHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (host === '') return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(host);
}

export function isNonPublicUrl(value) {
  if (typeof value !== 'string' || value === '') return false;
  if (value.startsWith('data:')) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return isNonPublicHost(parsed.hostname);
}

async function fetchAsDataUrl(url, signal) {
  let response;
  try {
    response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) });
  } catch (error) {
    signal?.throwIfAborted();
    throw new Error(`局域网素材读取失败：${url} · ${messageOf(error)}`);
  }
  if (!response.ok) throw new Error(`局域网素材读取失败：HTTP ${response.status} · ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error(`局域网素材为空：${url}`);
  if (bytes.byteLength > 2500000) {
    throw new Error(
      `局域网素材 ${(bytes.byteLength / 1048576).toFixed(1)} MB，内联后超过平台 4 MiB 请求上限，请压缩后重试`,
    );
  }
  const header = String(response.headers.get('content-type') || '').split(';')[0].trim();
  const mime = header.startsWith('image/') ? header : sniffMime(bytes);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export async function inlineReferences(references, signal) {
  if (!Array.isArray(references) || references.length === 0) return { references: undefined, inlined: 0 };
  const out = [];
  let budget = 3600000;
  let inlined = 0;
  for (const reference of references) {
    signal?.throwIfAborted();
    if (!reference || typeof reference.url !== 'string' || !isNonPublicUrl(reference.url)) {
      out.push(reference);
      continue;
    }
    if (reference.type !== 'image') {
      throw new Error(`参考${reference.type === 'video' ? '视频' : '音频'}必须是公网可访问的 URL（内联 data: 只支持图片）`);
    }
    const dataUrl = await fetchAsDataUrl(reference.url, signal);
    budget -= dataUrl.length;
    if (budget < 0) throw new Error('参考图内联后超过平台 4 MiB 请求上限，请减少张数或压缩后重试');
    inlined += 1;
    out.push({ ...reference, url: dataUrl });
  }
  return { references: out, inlined };
}
