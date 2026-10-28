/**
 * Media channel client with multi-channel routing.
 *
 * A channel is one reachable upstream: an address plus a key. Two drivers exist:
 *
 *  - `mote`          the unified media API (images, videos, tasks, model catalog):
 *                    POST /media/v1/images/generations, POST /media/v1/videos/generations,
 *                    GET /media/v1/tasks/{id}, POST /media/v1/tasks/{id}/cancel,
 *                    GET /media/v1/models. One mote key already reaches Seedream,
 *                    Seedance, Nano Banana/Gemini, GPT Image, Kling, MiniMax H3 and 3D.
 *  - `openai-images` any OpenAI-compatible image endpoint:
 *                    POST {base}/v1/images/generations with `{model, prompt, n, size}`,
 *                    answering either links or Base64.
 *
 * Every model the catalog reports carries its channel, so a generation is routed
 * to the channel that owns the chosen model. Base64 results are written to disk
 * and served back through the authenticated asset route.
 */
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join, isAbsolute, relative, extname, basename } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

/** Default file sink: the user's Pictures folder. */
export const DEFAULT_OUTPUT_DIR = join(homedir(), 'Pictures', 'mote-media');

/** Authenticated asset path the panel loads local artifacts from. */
export const ASSET_PATH = '/api/mote-media/asset';

const MODELS_TTL_MS = 5 * 60 * 1000;
const IMAGE_PATH = '/media/v1/images/generations';
const VIDEO_PATH = '/media/v1/videos/generations';

export const PENDING_STATUSES = new Set(['queued', 'running', 'reconciling']);
export const DRIVERS = ['mote', 'openai-images'];

/** Strip trailing slashes without touching the scheme. */
function trimBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function channelIdOf(index) {
  return `ch${index + 1}`;
}

/** Coerce one channel record; returns undefined when it cannot be addressed. */
export function normalizeChannel(raw, index = 0) {
  if (raw === null || typeof raw !== 'object') return undefined;
  const driver = DRIVERS.includes(raw.driver) ? raw.driver : 'mote';
  const baseUrl = trimBase(raw.baseUrl) || (driver === 'mote' ? 'https://platform.sgt.site' : '');
  if (baseUrl === '') return undefined;
  const models = Array.isArray(raw.models)
    ? raw.models.filter((item) => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim() : channelIdOf(index),
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : driver === 'mote' ? 'mote' : baseUrl,
    driver,
    baseUrl,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '',
    models,
    enabled: raw.enabled !== false,
  };
}

/** Coerce unknown input into a recorded config, keeping only known keys. */
export function normalizeConfig(raw) {
  const c = raw !== null && typeof raw === 'object' ? raw : {};
  const str = (value, fallback) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback);
  const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);

  let channels = Array.isArray(c.channels) ? c.channels.map(normalizeChannel).filter(Boolean) : [];
  if (channels.length === 0) {
    // Backward compatibility: the single-channel fields become one mote channel.
    const legacyKey = typeof c.apiKey === 'string' ? c.apiKey.trim() : '';
    const legacyBase = trimBase(c.baseUrl) || 'https://platform.sgt.site';
    channels = [
      {
        id: 'mote',
        name: 'mote',
        driver: 'mote',
        baseUrl: legacyBase,
        apiKey: legacyKey,
        models: [],
        enabled: true,
      },
    ];
  }
  // Channel ids must be unique: a duplicate would make routing ambiguous.
  const seen = new Set();
  channels = channels.map((channel, index) => {
    let id = channel.id;
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return { ...channel, id };
  });

  return {
    channels,
    imageModel: str(c.imageModel, ''),
    videoModel: str(c.videoModel, ''),
    outputDir: str(c.outputDir, ''),
    pollIntervalMs: Math.min(30000, Math.max(500, number(c.pollIntervalMs, 3000))),
  };
}

function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

const ERROR_HINTS = {
  unsupported_parameter: '该模型不接受这个字段，去掉后重试',
  model_not_found: '模型 id 不在当前密钥的目录里',
  model_not_authorized: '当前密钥未开通这个模型',
  invalid_request: '请求字段或取值不合法',
  invalid_prompt: '提示词为空或超过长度限制',
  content_review_failed: '提示词或参考素材未通过内容审核',
  rate_limited: '触发限流，退避后重试',
  insufficient_quota: '额度不足',
  task_not_cancelable: '任务已开始生成，不能取消',
  task_not_found: '任务 id 不存在或已过期',
  media_request_too_large: '请求体超过 4 MiB，减少或压缩参考素材',
};

function platformError(status, data) {
  const detail = data && typeof data === 'object' ? data.error : undefined;
  const message = detail && typeof detail === 'object' && typeof detail.message === 'string' ? detail.message : undefined;
  const code = detail && typeof detail === 'object' && typeof detail.code === 'string' ? detail.code : undefined;
  const stage = detail && typeof detail === 'object' && typeof detail.stage === 'string' ? detail.stage : undefined;
  const parts = [`HTTP ${status}`];
  if (code) parts.push(code);
  if (stage) parts.push(`(${stage})`);
  const body = message ?? (data && typeof data === 'object' ? JSON.stringify(data).slice(0, 400) : undefined);
  const hint = code && ERROR_HINTS[code] ? `（${ERROR_HINTS[code]}）` : '';
  return new Error(parts.join(' ') + (body ? `: ${body}` : '') + hint);
}

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

/** File extension for one artifact, never inferred from a URL path. */
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

/** Sniff an image format from its first bytes. */
export function sniffMime(bytes) {
  if (!bytes || bytes.length < 4) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  return 'image/png';
}

/** Normalize `references` from tool input into platform reference objects. */
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

/** True when a hostname is only reachable inside a LAN, a loopback, or a private CGNAT range. */
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

/** True for an http(s) URL whose host the platform cannot reach. */
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

/** Drop undefined, null, and empty-string fields so the platform never sees `null` values. */
function compact(source) {
  const out = {};
  if (source === null || typeof source !== 'object') return out;
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

/** Path of an OpenAI-compatible images endpoint, tolerating a root that already ends in /v1. */
function openAiImagesPath(baseUrl) {
  return /\/v1$/i.test(trimBase(baseUrl)) ? '/images/generations' : '/v1/images/generations';
}

/** Path of an OpenAI-compatible model list, tolerating a root that already ends in /v1. */
function openAiModelsPath(baseUrl) {
  return /\/v1$/i.test(trimBase(baseUrl)) ? '/models' : '/v1/models';
}

/** Heuristic label for a model id that did not carry a type (OpenAI-compatible catalogs). */
const IMAGE_ID_HINTS = /(image|dall-?e|flux|stable-?diffusion|sd3|sdxl|seedream|imagen|nano-?banana|gpt-image|midjourney|kolors|ideogram|recraft|playground|kling|seedance|wan|hunyuan)/i;

function artifactUrlFor(absPath, outputDir) {
  const rel = isAbsolute(absPath) && outputDir !== '' ? relative(outputDir, absPath) : absPath;
  return `${ASSET_PATH}?path=${encodeURIComponent(rel.split('\\').join('/'))}`;
}

/**
 * Create the shared multi-channel client.
 * @param initialConfig raw or normalized config.
 */
export function createMote(initialConfig) {
  const state = {
    config: normalizeConfig(initialConfig),
    /** channel id → { at, rows } */
    models: new Map(),
    /** local (OpenAI-compatible) results, keyed by synthetic task id */
    local: new Map(),
  };

  function configure(patch) {
    state.config = normalizeConfig({ ...state.config, ...(patch || {}) });
    state.models.clear();
    return state.config;
  }

  function resolveOutputDir(override) {
    const dir = typeof override === 'string' && override.trim() !== '' ? override.trim() : state.config.outputDir;
    return dir === '' ? DEFAULT_OUTPUT_DIR : dir;
  }

  function channels({ includeSecrets = false } = {}) {
    return state.config.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      driver: channel.driver,
      baseUrl: channel.baseUrl,
      models: channel.models.slice(),
      enabled: channel.enabled,
      configured: channel.apiKey !== '',
      ...(includeSecrets ? { apiKey: channel.apiKey } : {}),
    }));
  }

  function channelById(id) {
    if (typeof id === 'string' && id !== '') {
      return state.config.channels.find((channel) => channel.id === id || channel.name === id);
    }
    return undefined;
  }

  function enabledChannels() {
    return state.config.channels.filter((channel) => channel.enabled && channel.apiKey !== '');
  }

  function requireChannel(channel) {
    if (!channel) throw new Error('no such channel: configure it in Channel settings');
    if (channel.apiKey === '') throw new Error(`channel "${channel.name}" has no API key`);
    if (!channel.enabled) throw new Error(`channel "${channel.name}" is disabled`);
    return channel;
  }

  /**
   * One platform call. `idempotencyKey` is reused across the retries of a single
   * submission, which is what the platform's retry guidance requires: a retried
   * submit must not create a second paid task.
   */
  async function request(channel, path, { method = 'GET', body, idempotencyKey, timeoutMs = 120000, retries = 2 } = {}) {
    const headers = { Authorization: `Bearer ${channel.apiKey}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const payload = body === undefined ? undefined : JSON.stringify(body);
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetch(channel.baseUrl + path, {
          method,
          headers,
          body: payload,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (attempt < retries) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        throw new Error(`${channel.name} ${method} ${path} failed: ${messageOf(error)}`);
      }
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      const text = await response.text();
      const data = parseBody(text);
      if (!response.ok) throw platformError(response.status, data);
      return data;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Read a LAN/loopback image on this side and turn it into an inline data URL. */
  async function fetchAsDataUrl(url) {
    let response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    } catch (error) {
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

  /**
   * The platform fetches reference URLs itself, so a LAN address it cannot reach
   * has to be carried inline. Images may be inlined (the platform only accepts
   * `data:` for images); video and audio must stay public URLs.
   */
  async function inlineReferences(references) {
    if (!Array.isArray(references) || references.length === 0) return { references: undefined, inlined: 0 };
    const out = [];
    let budget = 3600000;
    let inlined = 0;
    for (const reference of references) {
      if (!reference || typeof reference.url !== 'string' || !isNonPublicUrl(reference.url)) {
        out.push(reference);
        continue;
      }
      if (reference.type !== 'image') {
        throw new Error(`参考${reference.type === 'video' ? '视频' : '音频'}必须是公网可访问的 URL（内联 data: 只支持图片）`);
      }
      const dataUrl = await fetchAsDataUrl(reference.url);
      budget -= dataUrl.length;
      if (budget < 0) throw new Error('参考图内联后超过平台 4 MiB 请求上限，请减少张数或压缩后重试');
      inlined += 1;
      out.push({ ...reference, url: dataUrl });
    }
    return { references: out, inlined };
  }

  /* ---- model catalog ---- */

  function openAiCatalog(channel) {
    return channel.models.map((id) => ({
      id,
      channelId: channel.id,
      channelName: channel.name,
      driver: channel.driver,
      type: 'image',
      provider: 'openai-images',
      sync: true,
      supportsCancel: false,
      parameters: {
        prompt: { type: 'string', required: true },
        n: { type: 'integer', minimum: 1, maximum: 4, default: 1 },
        size: { type: 'string', description: '1024x1024, 1536x1024, …' },
      },
      references: [],
      providerOptions: null,
    }));
  }

  async function listModels({ category, refresh = false, channelId } = {}) {
    const rows = [];
    const targets = channelId ? [requireChannel(channelById(channelId))] : enabledChannels();
    for (const channel of targets) {
      if (channel.driver === 'openai-images') {
        for (const model of openAiCatalog(channel)) rows.push(model);
        continue;
      }
      const cached = state.models.get(channel.id);
      const fresh = cached && Date.now() - cached.at < MODELS_TTL_MS;
      if (!fresh || refresh) {
        const data = await request(channel, '/media/v1/models');
        const list = data && Array.isArray(data.data) ? data.data : [];
        state.models.set(channel.id, { at: Date.now(), rows: list });
      }
      const cachedRows = state.models.get(channel.id);
      for (const row of (cachedRows ? cachedRows.rows : [])) {
        rows.push({
          id: row.id,
          channelId: channel.id,
          channelName: channel.name,
          driver: channel.driver,
          type: row.type,
          provider: row.provider,
          sync: row.sync === true,
          supportsCancel: row.supports_cancel === true,
          parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : {},
          references: Array.isArray(row.references) ? row.references : [],
          providerOptions: row.provider_options_schema ?? null,
        });
      }
    }
    return typeof category === 'string' && category !== '' ? rows.filter((row) => row.type === category) : rows;
  }

  function modelInfo(models, modelId) {
    return models.find((row) => row.id === modelId) || null;
  }

  function channelForModel(modelId, known) {
    const hit = known.find((row) => row.id === modelId);
    if (hit) return requireChannel(channelById(hit.channelId));
    const enabled = enabledChannels();
    if (enabled.length === 1) return enabled[0];
    if (enabled.length === 0) throw new Error('no channel is configured with an API key');
    throw new Error(`model "${modelId}" is not in any channel catalog; pass a channel explicitly`);
  }

  /* ---- generation ---- */

  function clampWait(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(50, Math.max(0, Math.trunc(value)));
  }

  /** Submit an image task on the channel that owns the model. */
  async function generateImage(input) {
    const catalog = input.catalog || (await listModels({ category: 'image' }));
    const modelId = input.model || state.config.imageModel || (catalog[0] ? catalog[0].id : '');
    if (modelId === '') throw new Error('no image model is available: set a key and refresh the catalog');
    const channel = input.channelId
      ? requireChannel(channelById(input.channelId))
      : channelForModel(modelId, catalog);

    if (channel.driver === 'openai-images') {
      return generateOpenAiImage(channel, { ...input, model: modelId });
    }

    const prepared = await inlineReferences(toReferences(input.references));
    const body = compact({
      model: modelId,
      prompt: input.prompt,
      n: input.n,
      resolution: input.resolution,
      aspect_ratio: input.aspect_ratio,
      size: input.size,
      output_format: input.output_format,
      provider_options: input.providerOptions,
      metadata: input.metadata,
      references: prepared.references,
      wait: clampWait(input.waitSeconds, 50),
    });
    const task = await request(channel, IMAGE_PATH, {
      method: 'POST',
      body,
      idempotencyKey: randomUUID(),
      timeoutMs: 90000,
    });
    const settled = await settle(task, input.waitSeconds ?? 60, channel);
    if (settled && prepared.inlined > 0) settled.inlined = prepared.inlined;
    return settled;
  }

  /** Submit a video task; long generations return the task for later polling. */
  async function generateVideo(input) {
    const catalog = input.catalog || (await listModels({ category: 'video' }));
    const modelId = input.model || state.config.videoModel || (catalog[0] ? catalog[0].id : '');
    if (modelId === '') throw new Error('no video model is available: set a key and refresh the catalog');
    const channel = input.channelId
      ? requireChannel(channelById(input.channelId))
      : channelForModel(modelId, catalog);
    if (channel.driver !== 'mote') throw new Error(`channel "${channel.name}" cannot generate video`);

    const prepared = await inlineReferences(toReferences(input.references));
    const body = compact({
      model: modelId,
      prompt: input.prompt,
      duration: input.duration,
      resolution: input.resolution,
      aspect_ratio: input.aspect_ratio,
      generate_audio: input.generateAudio,
      seed: input.seed,
      provider_options: input.providerOptions,
      metadata: input.metadata,
      references: prepared.references,
      wait: clampWait(input.waitSeconds, 0),
    });
    const task = await request(channel, VIDEO_PATH, {
      method: 'POST',
      body,
      idempotencyKey: randomUUID(),
      timeoutMs: 90000,
    });
    const settled = await settle(task, input.waitSeconds ?? 0, channel);
    if (settled && prepared.inlined > 0) settled.inlined = prepared.inlined;
    return settled;
  }

  /** OpenAI-compatible images are synchronous; the result becomes a finished local artifact. */
  async function generateOpenAiImage(channel, input) {
    const body = compact({
      model: input.model,
      prompt: input.prompt,
      n: Number.isFinite(input.n) ? input.n : undefined,
      size: input.size,
      response_format: undefined,
    });
    const data = await request(channel, openAiImagesPath(channel.baseUrl), {
      method: 'POST',
      body,
      timeoutMs: 180000,
    });
    const items = data && Array.isArray(data.data) ? data.data : [];
    if (items.length === 0) throw new Error(`${channel.name} returned no image`);
    const dir = resolveOutputDir();
    await mkdir(dir, { recursive: true });
    const taskId = `local_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const artifacts = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index] || {};
      let url = typeof item.url === 'string' && item.url !== '' ? item.url : '';
      let localPath = '';
      let mimeType = 'image/png';
      if (url === '' && typeof item.b64_json === 'string' && item.b64_json !== '') {
        const bytes = Buffer.from(item.b64_json, 'base64');
        mimeType = sniffMime(bytes);
        const extension = extensionFor({ mime_type: mimeType });
        localPath = join(dir, `${taskId}-${index}.${extension}`);
        await writeFile(localPath, bytes);
        url = artifactUrlFor(localPath, dir);
      }
      if (url === '') continue;
      artifacts.push({
        index,
        kind: 'image',
        mime_type: mimeType,
        state: 'available',
        url,
        url_type: localPath === '' ? 'upstream' : 'local',
        expires_at: null,
        ...(localPath === '' ? {} : { local_path: localPath }),
      });
    }
    if (artifacts.length === 0) throw new Error(`${channel.name} returned no usable image`);
    const task = {
      id: taskId,
      object: 'media.task',
      model: input.model,
      type: 'image',
      status: 'succeeded',
      progress: 100,
      created_at: Math.floor(Date.now() / 1000),
      started_at: Math.floor(Date.now() / 1000),
      finished_at: Math.floor(Date.now() / 1000),
      artifacts,
      error: null,
      billing: null,
      metadata: { channel: channel.id },
      request_id: null,
      channel_id: channel.id,
    };
    state.local.set(taskId, { task, channelId: channel.id, at: Date.now() });
    return task;
  }

  /* ---- tasks ---- */

  function localTask(id) {
    const hit = state.local.get(id);
    return hit ? hit.task : undefined;
  }

  async function getTask(id) {
    if (typeof id !== 'string' || id.trim() === '') throw new Error('task id is required');
    const local = localTask(id.trim());
    if (local) return local;
    const taskId = id.trim();
    const candidates = enabledChannels().filter((channel) => channel.driver === 'mote');
    if (candidates.length === 0) throw new Error('no mote channel is configured');
    let lastError = null;
    for (const channel of candidates) {
      try {
        return await request(channel, `/media/v1/tasks/${encodeURIComponent(taskId)}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('task not found');
  }

  async function getTasks(ids) {
    const list = Array.isArray(ids) ? ids.slice(0, 50) : [];
    const results = [];
    for (const id of list) {
      try {
        results.push({ id, task: await getTask(id) });
      } catch (error) {
        results.push({ id, error: messageOf(error) });
      }
    }
    return results;
  }

  async function cancelTask(id) {
    if (typeof id !== 'string' || id.trim() === '') throw new Error('task id is required');
    if (localTask(id.trim())) throw new Error('local results cannot be cancelled');
    const taskId = id.trim();
    const candidates = enabledChannels().filter((channel) => channel.driver === 'mote');
    let lastError = null;
    for (const channel of candidates) {
      try {
        return await request(channel, `/media/v1/tasks/${encodeURIComponent(taskId)}/cancel`, { method: 'POST' });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('task not found');
  }

  /** Poll one task until it reaches a terminal status or the budget expires. */
  async function settle(task, waitSeconds, channel) {
    if (!task || typeof task.id !== 'string') return task;
    if (!PENDING_STATUSES.has(task.status)) return task;
    const budgetMs = Math.max(0, waitSeconds) * 1000;
    if (budgetMs === 0) return task;
    const deadline = Date.now() + budgetMs;
    let current = task;
    while (PENDING_STATUSES.has(current.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, state.config.pollIntervalMs));
      try {
        current = channel
          ? await request(channel, `/media/v1/tasks/${encodeURIComponent(task.id)}`)
          : await getTask(task.id);
      } catch {
        break;
      }
    }
    return current;
  }

  /* ---- artifacts ---- */

  /** Download or copy every available artifact of one task into the configured directory. */
  async function saveArtifacts(task, options = {}) {
    if (!task || typeof task !== 'object') throw new Error('task object is required');
    const artifacts = Array.isArray(task.artifacts) ? task.artifacts : [];
    const wanted = artifacts.filter(
      (artifact) =>
        artifact &&
        artifact.state === 'available' &&
        (typeof artifact.url === 'string' || typeof artifact.local_path === 'string') &&
        (options.kinds ? options.kinds.includes(artifact.kind) : true),
    );
    const dir = resolveOutputDir(options.outputDir);
    if (wanted.length === 0) return { dir, saved: [], skipped: 'no available artifact' };
    await mkdir(dir, { recursive: true });
    const saved = [];
    for (const artifact of wanted) {
      const extension = extensionFor(artifact);
      const file = join(dir, `${String(task.id).replace(/[^A-Za-z0-9_.-]/g, '_')}-${artifact.index ?? saved.length}.${extension}`);
      if (typeof artifact.local_path === 'string' && artifact.local_path !== '') {
        try {
          if (basename(artifact.local_path) === basename(file)) {
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
        response = await fetch(artifact.url, { signal: AbortSignal.timeout(180000) });
      } catch (error) {
        saved.push({ path: file, kind: artifact.kind, error: messageOf(error) });
        continue;
      }
      if (!response.ok) {
        saved.push({ path: file, kind: artifact.kind, error: `download failed: HTTP ${response.status}` });
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        saved.push({ path: file, kind: artifact.kind, error: 'download returned an empty body' });
        continue;
      }
      await writeFile(file, bytes);
      saved.push({ path: file, kind: artifact.kind, mimeType: artifact.mime_type, bytes: bytes.byteLength });
    }
    return { dir, saved };
  }

  /**
   * Ask one channel what models it serves, so the settings panel never needs a
   * hand-typed list. `mote` channels answer with typed rows; OpenAI-compatible
   * channels answer with ids only, labelled by a heuristic.
   */
  async function discoverModels({ driver, baseUrl, apiKey, channelId } = {}) {
    const stored = channelId ? channelById(channelId) : undefined;
    const effectiveDriver = DRIVERS.includes(driver) ? driver : (stored && stored.driver) || 'mote';
    const effectiveBase = trimBase(baseUrl) || (stored && stored.baseUrl) || '';
    const effectiveKey = String(apiKey || '').trim() || (stored ? stored.apiKey : '');
    if (effectiveBase === '') throw new Error('base URL is required');
    if (effectiveKey === '') throw new Error('API key is required');
    const url = effectiveDriver === 'mote' ? `${effectiveBase}/media/v1/models` : effectiveBase + openAiModelsPath(effectiveBase);
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${effectiveKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      throw new Error(`${url} · ${messageOf(error)}`);
    }
    const text = await response.text();
    const data = parseBody(text);
    if (!response.ok) throw platformError(response.status, data);
    const rows = data && Array.isArray(data.data) ? data.data : [];
    const models = rows
      .map((row) => {
        const id = String((row && row.id) || '').trim();
        if (id === '') return null;
        const type = row && typeof row.type === 'string' ? row.type : IMAGE_ID_HINTS.test(id) ? 'image' : 'other';
        return { id, type };
      })
      .filter(Boolean);
    return {
      url,
      models,
      image: models.filter((row) => row.type === 'image').map((row) => row.id),
      video: models.filter((row) => row.type === 'video').map((row) => row.id),
    };
  }

  /** Connection facts plus credential presence for the panel header. */
  function status() {
    return {
      configured: enabledChannels().length > 0,
      channels: channels(),
      imageModel: state.config.imageModel,
      videoModel: state.config.videoModel,
      outputDir: resolveOutputDir(),
      pollIntervalMs: state.config.pollIntervalMs,
    };
  }

  return {
    configure,
    status,
    channels,
    channelById,
    listModels,
    discoverModels,
    modelInfo,
    generateImage,
    generateVideo,
    getTask,
    getTasks,
    cancelTask,
    settle,
    saveArtifacts,
    resolveOutputDir,
    localTask,
  };
}

