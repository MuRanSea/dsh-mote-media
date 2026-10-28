/**
 * Host half of the mote media plugin.
 *
 * Provides agent tools for image/video generation and one authenticated Web
 * route that the panel calls, so both callers share a single implementation.
 */
import { createMote, normalizeConfig, normalizeChannel, PENDING_STATUSES, ASSET_PATH, sniffMime, isNonPublicUrl } from './mote.js';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';

const PKG = '@local/dsh-mote-media';
const ROUTE_PATH = '/api/mote-media';

export const inject = ['tools'];

const textBlocks = (text) => [{ type: 'text', text }];
const asText = (value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

/**
 * Panel-saved values live in one file owned by this package, so the panel can
 * be configured even when the profile mounts no config editor.
 */
const OVERLAY_PATH = join(dirname(fileURLToPath(import.meta.url)), '.mote-state.json');

function readOverlay() {
  try {
    const parsed = JSON.parse(readFileSync(OVERLAY_PATH, 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverlay(patch) {
  const next = { ...readOverlay(), ...patch };
  writeFileSync(OVERLAY_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/** Resolve the plugin row's config with defaults, the panel overlay, and an environment fallback. */
function resolveConfig(raw) {
  const overlay = readOverlay();
  const normalized = normalizeConfig({ ...normalizeConfig(raw), ...overlay });
  if (normalized.channels.every((channel) => channel.apiKey === '')) {
    const fromEnv = typeof process.env.MOTE_API_KEY === 'string' ? process.env.MOTE_API_KEY.trim() : '';
    if (fromEnv !== '') {
      normalized.channels = normalized.channels.map((channel, index) =>
        index === 0 ? { ...channel, apiKey: fromEnv } : channel,
      );
    }
  }
  return normalized;
}

function trimTask(task) {
  if (!task || typeof task !== 'object') return task;
  const artifacts = Array.isArray(task.artifacts)
    ? task.artifacts.map((artifact) => ({
        index: artifact.index,
        kind: artifact.kind,
        state: artifact.state,
        mimeType: artifact.mime_type,
        url: artifact.url,
        urlType: artifact.url_type,
        expiresAt: artifact.expires_at ?? null,
      }))
    : [];
  return {
    id: task.id,
    type: task.type,
    model: task.model,
    status: task.status,
    progress: task.progress,
    createdAt: task.created_at ?? null,
    finishedAt: task.finished_at ?? null,
    artifacts,
    error:
      task.error === null || task.error === undefined
        ? null
        : {
            code: task.error.code,
            message: task.error.message,
            stage: task.error.stage,
            retryable: task.error.retryable,
          },
    billing: task.billing ?? null,
    requestId: task.request_id ?? null,
    inlined: Number.isFinite(task.inlined) ? task.inlined : 0,
  };
}

/** One-line human summary of a task for a tool result. */
function summarize(task) {
  if (!task || typeof task !== 'object') return 'no task';
  const head = `${task.model ?? 'model'} ${task.type ?? ''} ${task.id ?? ''} → ${task.status ?? 'unknown'}`;
  if (task.error && typeof task.error.message === 'string') return `${head} (${task.error.message})`;
  const count = Array.isArray(task.artifacts) ? task.artifacts.filter((a) => a.state === 'available').length : 0;
  if (count > 0) return `${head}, ${count} artifact(s) ready`;
  if (PENDING_STATUSES.has(task.status)) return `${head}, still generating`;
  return head;
}

const ACTION_FAILURE = (error) => ({ ok: false, error: { message: error instanceof Error ? error.message : String(error) } });

function createRouteHandler(mote, ctx, diag) {
  return async function handle(request) {
    try {
      if (request.method === 'GET') return json({ ok: true, ...mote.status(), canEditConfig: Boolean(ctx.get('configEditor')) });
      const body = await request.json().catch(() => null);
      if (body === null || typeof body !== 'object') return json({ ok: false, error: { message: 'invalid JSON body' } }, 400);
      const action = typeof body.action === 'string' ? body.action : '';
      switch (action) {
        case 'state':
          return json({
            ok: true,
            ...mote.status(),
            canEditConfig: true,
            route: { path: ROUTE_PATH, registered: diag.registered, error: diag.error, connection: diag.connection },
          });
        case 'selftest':
          return json({
            ok: true,
            route: { path: ROUTE_PATH, registered: diag.registered, error: diag.error, connection: diag.connection },
            configEditor: Boolean(ctx.get('configEditor')),
            configured: mote.status().configured,
            overlayPath: OVERLAY_PATH,
          });
        case 'models': {
          const models = await mote.listModels({
            category: body.category,
            refresh: body.refresh === true,
            channelId: typeof body.channelId === 'string' ? body.channelId : undefined,
          });
          return json({ ok: true, models, channels: mote.channels() });
        }
        case 'generate': {
          const kind = body.kind === 'video' ? 'video' : 'image';
          const input = {
            model: body.model,
            prompt: typeof body.prompt === 'string' ? body.prompt : '',
            ...(body.params && typeof body.params === 'object' ? body.params : {}),
            references: body.references,
            providerOptions: body.providerOptions,
            metadata: body.metadata,
          };
          if (typeof body.channelId === 'string' && body.channelId !== '') input.channelId = body.channelId;
          const task = kind === 'video' ? await mote.generateVideo(input) : await mote.generateImage(input);
          return json({ ok: true, task: trimTask(task) });
        }
        case 'tasks': {
          const rows = await mote.getTasks(Array.isArray(body.ids) ? body.ids : []);
          return json({
            ok: true,
            tasks: rows.map((row) => (row.task ? { id: row.id, task: trimTask(row.task) } : { id: row.id, error: row.error })),
          });
        }
        case 'task': {
          const task = await mote.getTask(body.id);
          return json({ ok: true, task: trimTask(task) });
        }
        case 'cancel': {
          const task = await mote.cancelTask(body.id);
          return json({ ok: true, task: trimTask(task) });
        }
        case 'download': {
          const task = await mote.getTask(body.id);
          const result = await mote.saveArtifacts(task);
          return json({ ok: true, dir: result.dir, saved: result.saved, task: trimTask(task) });
        }
        case 'probe': {
          const result = await mote.discoverModels({
            driver: typeof body.driver === 'string' ? body.driver : undefined,
            baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
            apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
            channelId: typeof body.channelId === 'string' ? body.channelId : undefined,
          });
          return json({ ok: true, ...result });
        }
        case 'config': {
          return await saveConfig(ctx, mote, body.patch);
        }
        default:
          return json({ ok: false, error: { message: `unknown action: ${action}` } }, 400);
      }
    } catch (error) {
      return json(ACTION_FAILURE(error));
    }
  };
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Persist panel edits (package-owned overlay) and mirror them into the loader row when possible. */
async function saveConfig(ctx, mote, patch) {
  if (patch === null || typeof patch !== 'object') return json({ ok: false, error: { message: 'patch is required' } }, 400);
  const next = {};
  for (const key of ['baseUrl', 'apiKey', 'imageModel', 'videoModel', 'outputDir']) {
    if (typeof patch[key] === 'string') next[key] = patch[key].trim();
  }
  if (Array.isArray(patch.channels)) {
    // The panel never receives stored keys, so a blank key means "keep the old one".
    const current = mote.channels({ includeSecrets: true });
    const channels = patch.channels
      .map(normalizeChannel)
      .filter(Boolean)
      .map((channel) => {
        if (channel.apiKey !== '') return channel;
        const existing = current.find((item) => item.id === channel.id);
        return existing && typeof existing.apiKey === 'string' && existing.apiKey !== ''
          ? { ...channel, apiKey: existing.apiKey }
          : channel;
      });
    if (channels.length > 0) next.channels = channels;
  }
  if (Number.isFinite(patch.pollIntervalMs)) next.pollIntervalMs = patch.pollIntervalMs;
  if (Object.keys(next).length === 0) return json({ ok: false, error: { message: 'nothing to save' } }, 400);
  mote.configure(next);
  let mirrored = false;
  const editor = ctx.get('configEditor');
  if (editor) {
    const entry = findEntry(editor);
    if (entry) {
      try {
        await editor.edit(entry, (current) => ({ ...(current || {}), ...next }));
        mirrored = true;
      } catch {
        /* fall through to the overlay */
      }
    }
  }
  if (mirrored) {
    // The loader row now owns the values; drop a stale overlay so the file and
    // the profile cannot disagree.
    try {
      rmSync(OVERLAY_PATH, { force: true });
    } catch {
      /* nothing to remove */
    }
  } else {
    try {
      writeOverlay(next);
    } catch (error) {
      return json({
        ok: false,
        error: {
          message: `cannot write ${OVERLAY_PATH}: ${error instanceof Error ? error.message : String(error)}`,
        },
      });
    }
  }
  return json({ ok: true, mirrored, ...mote.status(), canEditConfig: true });
}

function findEntry(editor) {
  let entries;
  try {
    entries = editor.entries();
  } catch {
    return undefined;
  }
  if (!Array.isArray(entries)) return undefined;
  return entries.find((entry) => {
    const name = entry?.name ?? entry?.options?.name ?? entry?.data?.name;
    return name === PKG;
  });
}

/** Cached model parameter descriptions for tool schemas are unnecessary: tools accept loose params. */
function registerTools(ctx, mote) {
  const register = (definition) => {
    ctx.effect(() => ctx.tools.register(definition), `mote-media: ${definition.name}`);
  };

  register({
    name: 'mote_models',
    description:
      'List the image/video models this mote channel key may use, with each model id, type, and accepted parameters. Call this before generating when the model name or its allowed resolution/aspect-ratio values are unknown.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['image', 'video'],
          description: 'Restrict the list to one media type; omit for both.',
        },
        channel: {
          type: 'string',
          description: 'Channel id or name to ask (omit to query every configured channel).',
        },
        refresh: { type: 'boolean', description: 'Bypass the 5-minute catalog cache.' },
      },
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          models: { type: 'array', items: { type: 'object' } },
          error: { type: 'string' },
        },
      },
      render: (_args, value) => textBlocks(asText(value)),
    },
    async execute(args) {
      try {
        const models = await mote.listModels({
          category: args?.category,
          refresh: args?.refresh === true,
          channelId: typeof args?.channel === 'string' && args.channel !== '' ? args.channel : undefined,
        });
        return { models, channels: mote.channels() };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  register({
    name: 'mote_image',
    description:
      'Generate or edit an image through the mote channel (Seedream, Nano Banana/Gemini, or GPT Image). Waits for the result, then saves every generated image to disk and returns their local paths and URLs.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to draw; required by every image model.' },
        model: { type: 'string', description: 'Model id from mote_models; defaults to the configured image model.' },
        channel: {
          type: 'string',
          description: 'Channel id or name that owns the model; omit to route by the model catalog.',
        },
        resolution: { type: 'string', description: 'Quality tier: 1K / 1.5K / 2K / 3K / 4K, per model.' },
        aspect_ratio: {
          type: 'string',
          description: 'e.g. 16:9, 1:1, 3:4, 9:16, 21:9. Cannot be combined with size.',
        },
        size: {
          type: 'string',
          description: 'Exact pixels such as 2560x1440, or a tier for Seedream. Cannot be combined with aspect_ratio.',
        },
        n: { type: 'integer', minimum: 1, maximum: 15, description: 'Image count for Seedream group output.' },
        output_format: { type: 'string', enum: ['jpeg', 'png'], description: 'Seedream only.' },
        watermark: { type: 'boolean', description: 'Seedream AI watermark.' },
        references: {
          type: 'array',
          items: { type: 'string' },
          description: 'Reference images for editing or fusion: public HTTPS URLs, or platform file ids.',
        },
        save: { type: 'boolean', description: 'Download the images to disk (default true).' },
        wait_seconds: {
          type: 'integer',
          minimum: 0,
          maximum: 50,
          description: 'How long to wait for the result before returning a task id (default 60s budget).',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          task: { type: 'object' },
          saved: { type: 'array', items: { type: 'object' } },
          summary: { type: 'string' },
          error: { type: 'string' },
        },
      },
      render: (_args, value) => textBlocks(asText(value)),
    },
    async execute(args) {
      try {
        const task = await mote.generateImage({
          prompt: args?.prompt,
          model: args?.model,
          channelId: typeof args?.channel === 'string' && args.channel !== '' ? args.channel : undefined,
          resolution: args?.resolution,
          aspect_ratio: args?.aspect_ratio,
          size: args?.size,
          n: args?.n,
          output_format: args?.output_format,
          references: args?.references,
          providerOptions:
            typeof args?.watermark === 'boolean' ? { volcengine: { watermark: args.watermark } } : undefined,
          waitSeconds: Number.isFinite(args?.wait_seconds) ? args.wait_seconds : 60,
        });
        let saved;
        if (task?.status === 'succeeded' && args?.save !== false) {
          saved = await mote.saveArtifacts(task, { kinds: ['image'] });
        }
        return { task: trimTask(task), saved: saved?.saved, summary: summarize(task) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  register({
    name: 'mote_video',
    description:
      'Generate a video through the mote channel (Seedance, Kling, or MiniMax H3). Text-to-video, first frame, first+last frame, or multimodal references. Returns a task id; poll with mote_media_task until it succeeds, then download.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Shot description. Required by Kling and MiniMax H3; Seedance also accepts references-only.' },
        model: { type: 'string', description: 'Model id from mote_models; defaults to the configured video model.' },
        channel: {
          type: 'string',
          description: 'Channel id or name that owns the model; video needs a mote channel.',
        },
        duration: { type: 'integer', minimum: 3, maximum: 30, description: 'Seconds; range depends on the model (Seedance 4-15, Kling 3-15, H3 4-15).' },
        resolution: {
          type: 'string',
          description: 'Seedance/Kling: 480p 720p 1080p 4k. MiniMax H3: 768P 2K (uppercase).',
        },
        aspect_ratio: { type: 'string', description: 'e.g. 16:9, 9:16, 1:1, 21:9, adaptive.' },
        generate_audio: { type: 'boolean', description: 'Kling and Seedance support it; H3 and Kling Turbo reject it.' },
        seed: { type: 'integer', description: 'Seedance only.' },
        first_frame: { type: 'string', description: 'First-frame image: public HTTPS URL or platform file id.' },
        last_frame: { type: 'string', description: 'Last-frame image; requires first_frame.' },
        references: {
          type: 'array',
          description: 'Multimodal reference material (Seedance, Kling Omni, MiniMax H3).',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['reference', 'first_frame', 'last_frame', 'voice'] },
              type: { type: 'string', enum: ['image', 'video', 'audio'] },
              url: { type: 'string', description: 'Public HTTP(S) URL.' },
              file_id: { type: 'string', description: 'Platform upload id instead of a URL.' },
            },
            additionalProperties: false,
          },
        },
        watermark: { type: 'boolean', description: 'Add a vendor watermark when the model supports it.' },
        wait_seconds: {
          type: 'integer',
          minimum: 0,
          maximum: 50,
          description: 'Submit-side wait; video needs 0 and polling (default 0).',
        },
      },
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          task: { type: 'object' },
          summary: { type: 'string' },
          error: { type: 'string' },
        },
      },
      render: (_args, value) => textBlocks(asText(value)),
    },
    async execute(args) {
      try {
        const references = Array.isArray(args?.references) ? args.references.slice() : [];
        if (typeof args?.first_frame === 'string' && args.first_frame !== '') {
          references.push({ role: 'first_frame', type: 'image', ...asSource(args.first_frame) });
        }
        if (typeof args?.last_frame === 'string' && args.last_frame !== '') {
          references.push({ role: 'last_frame', type: 'image', ...asSource(args.last_frame) });
        }
        const task = await mote.generateVideo({
          prompt: args?.prompt,
          model: args?.model,
          channelId: typeof args?.channel === 'string' && args.channel !== '' ? args.channel : undefined,
          duration: args?.duration,
          resolution: args?.resolution,
          aspect_ratio: args?.aspect_ratio,
          generateAudio: args?.generate_audio,
          seed: args?.seed,
          references: references.length > 0 ? references : undefined,
          providerOptions: typeof args?.watermark === 'boolean' ? { watermark: args.watermark } : undefined,
          waitSeconds: Number.isFinite(args?.wait_seconds) ? args.wait_seconds : 0,
        });
        return { task: trimTask(task), summary: summarize(task) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
    timeoutMs: 180000,
  });

  register({
    name: 'mote_media_task',
    description:
      'Inspect, cancel, or download a mote media task. Use status to poll a video/image task id, cancel to stop a queued Seedance task, and download to save finished artifacts locally.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'cancel', 'download'], description: 'Operation to perform.' },
        task_id: { type: 'string', description: 'Task id returned by mote_image or mote_video.' },
        wait_seconds: {
          type: 'integer',
          minimum: 0,
          maximum: 600,
          description: 'For status: keep polling up to this many seconds while the task is still running.',
        },
      },
      required: ['action', 'task_id'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          task: { type: 'object' },
          saved: { type: 'array', items: { type: 'object' } },
          summary: { type: 'string' },
          error: { type: 'string' },
        },
      },
      render: (_args, value) => textBlocks(asText(value)),
    },
    async execute(args) {
      try {
        const id = typeof args?.task_id === 'string' ? args.task_id.trim() : '';
        if (id === '') return { error: 'task_id is required' };
        if (args?.action === 'cancel') {
          const task = await mote.cancelTask(id);
          return { task: trimTask(task), summary: summarize(task) };
        }
        const waitSeconds = Number.isFinite(args?.wait_seconds) ? args.wait_seconds : 0;
        let task = await mote.getTask(id);
        if (PENDING_STATUSES.has(task.status) && waitSeconds > 0) {
          const deadline = Date.now() + waitSeconds * 1000;
          while (PENDING_STATUSES.has(task.status) && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            task = await mote.getTask(id);
          }
        }
        if (args?.action === 'download') {
          const saved = await mote.saveArtifacts(task);
          return { task: trimTask(task), saved: saved.saved, summary: summarize(task) };
        }
        return { task: trimTask(task), summary: summarize(task) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
    timeoutMs: 660000,
  });
}

function asSource(value) {
  return value.startsWith('http') ? { url: value } : { file_id: value };
}

/**
 * Serve one locally written artifact (Base64 results from an OpenAI-compatible
 * channel). The path must stay inside the configured download directory.
 */
async function serveAsset(request, mote) {
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

/**
 * Claim the authenticated `/api/mote-media` route.
 *
 * The Connection service may not exist yet when this plugin activates, so the
 * registration is retried through `ctx.inject` and its outcome is recorded for
 * the panel's diagnostics.
 */
function registerRoute(ctx, mote, diag) {
  let disposeRoute = null;
  let disposeAsset = null;

  const installAsset = (connection) => {
    if (disposeAsset !== null) return;
    try {
      disposeAsset = connection.fetch.register({
        path: ASSET_PATH,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: (request) => serveAsset(request, mote),
      });
    } catch (error) {
      diag.error = error instanceof Error ? error.message : String(error);
    }
  };

  const install = (scope) => {
    const connection = scope.get('connection');
    diag.connection = Boolean(connection);
    if (!connection || typeof connection.fetch?.register !== 'function') {
      diag.error = 'the connection service does not expose fetch.register()';
      return;
    }
    installAsset(connection);
    if (diag.registered) return;
    try {
      disposeRoute = connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: createRouteHandler(mote, ctx, diag),
      });
      diag.registered = true;
      diag.error = null;
    } catch (error) {
      diag.error = error instanceof Error ? error.message : String(error);
    }
  };

  install(ctx);
  try {
    ctx.inject(['connection'], (scope) => {
      install(scope);
    });
  } catch {
    /* an older Cordis without the inject helper keeps the direct attempt */
  }

  ctx.effect(
    () => () => {
      for (const dispose of [disposeRoute, disposeAsset]) {
        if (dispose === null) continue;
        try {
          dispose();
        } catch {
          /* already gone */
        }
      }
      disposeRoute = null;
      disposeAsset = null;
      diag.registered = false;
    },
    'mote-media: route cleanup',
  );

  // Loopback-only status probe: lets a person or a shell confirm that the panel
  // route is mounted, without a browser session. It carries no key material.
  const webServer = ctx.get('webServer');
  if (webServer && typeof webServer.register === 'function') {
    ctx.effect(
      () =>
        webServer.register({
          kind: 'exact',
          path: '/mote-media/status',
          handler: (request, response) => {
            const host = String(request.headers.host || '');
            const loopback = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host);
            if (!loopback) {
              response.writeHead(403);
              response.end('forbidden');
              return;
            }
            const body = {
              ok: true,
              route: ROUTE_PATH,
              assetRoute: ASSET_PATH,
              registered: diag.registered,
              connection: diag.connection,
              error: diag.error,
              configured: mote.status().configured,
              channels: mote.channels(),
              configEditor: Boolean(ctx.get('configEditor')),
            };
            response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            response.end(JSON.stringify(body));
          },
        }),
      'mote-media: status probe',
    );
  }
}

export function apply(ctx, config) {
  const diag = { registered: false, error: null, connection: false };
  const mote = createMote(resolveConfig(config));
  registerTools(ctx, mote);
  registerRoute(ctx, mote, diag);
}





