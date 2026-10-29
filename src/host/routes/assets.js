import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { sniffMime } from '../media/artifacts.js';
import { isNonPublicUrl } from '../media/references.js';

export async function serveAsset(request, mote) {
  const url = new URL(request.url);

  // LAN artifacts are proxied so the page never needs to reach the gateway's
  // private address itself. Only private targets are accepted: no open proxy.
  const remote = url.searchParams.get('url');
  if (remote !== null && remote !== '') {
    if (!/^https?:\/\//i.test(remote) || !isNonPublicUrl(remote)) {
      return new Response('only lan targets are proxied', { status: 403 });
    }
    let upstream;
    try {
      upstream = await fetch(remote, { signal: AbortSignal.timeout(30000) });
    } catch {
      return new Response('upstream unreachable', { status: 502 });
    }
    if (!upstream.ok) return new Response(`upstream ${upstream.status}`, { status: 502 });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.byteLength > 64 * 1024 * 1024) return new Response('too large', { status: 413 });
    return new Response(bytes, {
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'private, max-age=300',
      },
    });
  }

  const requested = url.searchParams.get('path');
  if (requested === null || requested === '') return new Response('missing path', { status: 400 });
  const dir = mote.resolveOutputDir();
  const target = resolve(dir, requested);
  const rel = relative(dir, target);
  if (rel.startsWith('..') || isAbsolute(rel) || rel === '') {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const bytes = await readFile(target);
    return new Response(bytes, {
      headers: { 'content-type': sniffMime(bytes), 'cache-control': 'private, max-age=86400' },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
