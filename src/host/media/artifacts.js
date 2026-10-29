import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import { join, isAbsolute, relative, extname, resolve } from 'node:path';
import { messageOf } from '../channels/request.js';

export const ASSET_PATH = '/api/mote-media/asset';

const MIME_EXTENSIONS = [
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
  ['audio/wav', 'wav'],
  ['audio/mpeg', 'mp3'],
];

export function extensionFor(artifact) {
  const mime = typeof artifact?.mime_type === 'string' ? artifact.mime_type.toLowerCase() : '';
  const hit = MIME_EXTENSIONS.find(([type]) => mime === type);
  if (hit) return hit[1];
  const local = typeof artifact?.local_path === 'string' ? extname(artifact.local_path).replace('.', '') : '';
  if (local !== '') return local;
  if (mime.startsWith('video/')) return 'mp4';
  if (mime.startsWith('image/')) return 'png';
  if (mime.startsWith('audio/')) return 'wav';
  return 'bin';
}

export function sniffMime(bytes) {
  if (!bytes || bytes.length < 4) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  return 'image/png';
}

export function artifactUrlFor(absPath, outputDir) {
  const rel = isAbsolute(absPath) && outputDir !== '' ? relative(outputDir, absPath) : absPath;
  return `${ASSET_PATH}?path=${encodeURIComponent(rel.split('\\').join('/'))}`;
}

export function createArtifactStore({ resolveOutputDir }) {
  async function saveArtifacts(task, options = {}) {
    if (!task || typeof task !== 'object') throw new Error('task object is required');
    const artifacts = Array.isArray(task.artifacts) ? task.artifacts : [];
    if (options.artifactIndex !== undefined && (!Number.isInteger(options.artifactIndex) || options.artifactIndex < 0 || options.artifactIndex >= artifacts.length)) throw new Error('invalid artifact index');
    const wanted = artifacts.filter(
      (artifact, position) =>
        artifact &&
        artifact.state === 'available' &&
        (typeof artifact.url === 'string' || typeof artifact.local_path === 'string') &&
        (options.kinds ? options.kinds.includes(artifact.kind) : true) &&
        (options.artifactIndex === undefined || options.artifactIndex === position),
    );
    const dir = resolveOutputDir(options.outputDir);
    if (wanted.length === 0) return { dir, saved: [], skipped: 'no available artifact' };
    await mkdir(dir, { recursive: true });
    const saved = [];
    for (const artifact of wanted) {
      options.signal?.throwIfAborted();
      const extension = extensionFor(artifact);
      const file = join(dir, `${String(task.id).replace(/[^A-Za-z0-9_.-]/g, '_')}-${artifact.index ?? saved.length}.${extension}`);
      if (typeof artifact.local_path === 'string' && artifact.local_path !== '') {
        try {
          if (resolve(artifact.local_path) === resolve(file)) {
            await access(artifact.local_path);
            saved.push({ path: artifact.local_path, kind: artifact.kind, mimeType: artifact.mime_type });
          } else {
            await copyFile(artifact.local_path, file);
            saved.push({ path: file, kind: artifact.kind, mimeType: artifact.mime_type });
          }
        } catch (error) {
          saved.push({ path: file, kind: artifact.kind, error: messageOf(error) });
        }
        continue;
      }
      let response;
      try {
        response = await fetch(artifact.url, { signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000) });
      } catch (error) {
        options.signal?.throwIfAborted();
        saved.push({ path: file, kind: artifact.kind, error: messageOf(error) });
        continue;
      }
      if (!response.ok) {
        saved.push({ path: file, kind: artifact.kind, error: `download failed: HTTP ${response.status}` });
        continue;
      }
      try {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.byteLength === 0) throw new Error('download returned an empty body');
        await writeFile(file, bytes);
        saved.push({ path: file, kind: artifact.kind, mimeType: artifact.mime_type, bytes: bytes.byteLength });
      } catch (error) {
        saved.push({ path: file, kind: artifact.kind, error: messageOf(error) });
      }
    }
    return { dir, saved: saved.map((item, index) => ({
      ...item, artifactIndex: artifacts.indexOf(wanted[index]),
      ...(!item.error ? { url: artifactUrlFor(item.path, dir) } : {}),
    })) };
  }

  return { saveArtifacts };
}
