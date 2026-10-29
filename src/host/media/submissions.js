import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, existsSync, statSync, realpathSync, readdirSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { trimTask } from './task-view.js';
import { PENDING_STATUSES } from './tasks.js';
import { ASSET_PATH, sniffMime } from './artifacts.js';

function failure(message, code) {
  return Object.assign(new Error(message), { code });
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

/** Durable intent/receipt storage. A permanent exclusive marker claims each paid attempt. */
export function createSubmissionStore(directory, mote) {
  const active = new Map();
  const downloads = new Map();
  const paths = (id) => {
    if (typeof id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(id)) throw failure('submissionId is required', 'submission_id_required');
    const name = createHash('sha256').update(id).digest('hex');
    return { record: join(directory, `${name}.json`), claim: join(directory, `${name}.lock`) };
  };
  function read(id) {
    const path = paths(id).record;
    try {
      const entry = JSON.parse(readFileSync(path, 'utf8'));
      if (entry.id !== id || !entry.snapshot) throw new Error('invalid record');
      return entry;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw failure('生成记录不可读，请保留提交标识并核实结果', 'submission_store_unavailable');
    }
  }
  function update(id, patch) {
    const entry = read(id);
    if (!entry) throw failure('生成记录不存在', 'submission_not_found');
    const next = { ...entry, ...patch, updatedAt: Date.now() };
    // A slower status response must not replace an already terminal receipt.
    if (entry.task && !PENDING_STATUSES.has(entry.task.status) && patch.task && PENDING_STATUSES.has(patch.task.status)) next.task = entry.task;
    const path = paths(id).record;
    const temporary = `${path}.${randomUUID()}.tmp`;
    writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 });
    renameSync(temporary, path);
    return next;
  }
  function view(entry, includeSnapshot = false) {
    let state = entry.state;
    if (state === 'prepared' && existsSync(paths(entry.id).claim)) state = active.has(entry.id) ? 'submitting' : 'unknown';
    if (state === 'submitting' && !active.has(entry.id) && !entry.task) state = 'unknown';
    return {
      id: entry.id, state, channelId: entry.snapshot.channelId, kind: entry.snapshot.kind,
      model: entry.snapshot.model, createdAt: entry.createdAt, snapshotAvailable: true,
      task: entry.task ? trimTask(entry.task) : null,
      error: entry.error || (state === 'unknown' ? { code: 'submission_unknown', message: '提交结果待核实，请恢复查询，避免重复生成' } : null),
      ...(entry.context?.source === 'chat' ? {
        source: 'chat', creation: {
          prompt: entry.snapshot.prompt, originalPrompt: entry.snapshot.originalPrompt || entry.snapshot.prompt,
          params: Object.fromEntries(Object.entries(entry.snapshot.params).filter(([key]) => !['providerOptions', 'waitSeconds'].includes(key))),
        }, saved: entry.saved || [],
      } : {}),
      ...(includeSnapshot ? { snapshot: entry.snapshot } : {}),
    };
  }
  function prepare(id, raw, context) {
    paths(id);
    if (!raw || !['image', 'video'].includes(raw.kind) || typeof raw.model !== 'string' || !raw.model || typeof raw.prompt !== 'string' || !raw.prompt.trim()) {
      throw failure('生成输入不完整', 'invalid_snapshot');
    }
    const channel = mote.channelById(raw.channelId);
    if (!channel || !channel.enabled || !channel.apiKey) throw failure('请选择已配置的渠道和模型', 'channel_unavailable');
    if (raw.kind === 'video' && channel.driver !== 'mote') throw failure('该渠道不支持视频', 'channel_unavailable');
    if (channel.driver === 'openai-images' && raw.references?.length) throw failure('该 OpenAI 图片驱动不支持参考素材', 'references_unsupported');
    if ((raw.params !== undefined && (!raw.params || typeof raw.params !== 'object' || Array.isArray(raw.params))) || (raw.references !== undefined && !Array.isArray(raw.references))) throw failure('生成参数或参考素材格式错误', 'invalid_snapshot');
    const snapshot = JSON.parse(JSON.stringify({
      kind: raw.kind, channelId: channel.id, model: raw.model, prompt: raw.prompt.trim(),
      params: raw.params && typeof raw.params === 'object' && !Array.isArray(raw.params) ? raw.params : {},
      references: Array.isArray(raw.references) ? raw.references : [],
      ...(typeof raw.originalPrompt === 'string' ? { originalPrompt: raw.originalPrompt } : {}),
    }));
    const encoded = JSON.stringify(snapshot);
    if (Buffer.byteLength(encoded) > 4 * 1024 * 1024) throw failure('输入快照超过 4 MiB，请减少或压缩参考素材', 'snapshot_too_large');
    const fingerprint = createHash('sha256').update(JSON.stringify(canonical(snapshot))).digest('hex');
    const existing = read(id);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw failure('同一提交标识不能用于不同输入', 'submission_conflict');
      return view(existing);
    }
    if (existsSync(paths(id).claim)) throw failure('提交标记已存在，结果待核实', 'submission_unknown');
    snapshot.references = snapshot.references.map((reference) => {
      if (!reference || typeof reference !== 'object' || !['image', 'video', 'audio'].includes(reference.type) || !(reference.url || reference.file_id || reference.asset_id)) throw failure('参考素材不完整', 'invalid_reference');
      if (typeof reference.url !== 'string' || !reference.url.startsWith(`${ASSET_PATH}?`)) return reference;
      const requested = new URL(reference.url, 'http://owned.invalid').searchParams.get('path');
      const directory = mote.resolveOutputDir();
      const target = requested ? resolve(directory, requested) : directory;
      const rel = relative(directory, target);
      if (!rel || rel.startsWith('..') || isAbsolute(rel) || reference.type !== 'image') throw failure('本地参考素材路径无效', 'invalid_reference');
      const actual = realpathSync(target);
      const actualRelative = relative(realpathSync(directory), actual);
      if (!actualRelative || actualRelative.startsWith('..') || isAbsolute(actualRelative)) throw failure('本地参考素材路径无效', 'invalid_reference');
      if (statSync(actual).size > 2500000) throw failure('本地参考图过大，请压缩后重试', 'snapshot_too_large');
      const bytes = readFileSync(actual);
      return { ...reference, url: `data:${sniffMime(bytes)};base64,${bytes.toString('base64')}` };
    });
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 4 * 1024 * 1024) throw failure('输入快照超过 4 MiB，请压缩参考素材', 'snapshot_too_large');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const entry = { id, snapshot, fingerprint, ...(context ? { context } : {}), upstreamKey: randomUUID(), state: 'prepared', dispatched: false, createdAt: Date.now() };
    try {
      writeFileSync(paths(id).record, JSON.stringify(entry), { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw failure('无法保存输入快照，未提交生成', 'submission_store_unavailable');
      const winner = read(id);
      if (winner.fingerprint !== fingerprint) throw failure('同一提交标识不能用于不同输入', 'submission_conflict');
      return view(winner);
    }
    return view(entry);
  }
  async function get(id, { includeSnapshot = false, includeContext = false, refresh = true, signal } = {}) {
    signal?.throwIfAborted();
    let entry = read(id);
    if (!entry) throw failure('生成记录不存在', 'submission_not_found');
    if (refresh && entry.task?.id && PENDING_STATUSES.has(entry.task.status)) {
      try {
        const task = await mote.getTask(entry.task.id, entry.snapshot.channelId, signal);
        entry = update(id, { task, state: 'accepted', error: null });
      } catch (error) {
        signal?.throwIfAborted();
        return { ...view(entry, includeSnapshot), queryError: error.message };
      }
    }
    return { ...view(entry, includeSnapshot), ...(includeContext ? { context: entry.context || null } : {}) };
  }
  async function generate(id, { signal } = {}) {
    signal?.throwIfAborted();
    if (active.has(id)) return active.get(id);
    let entry = read(id);
    if (!entry) throw failure('请先保存生成输入', 'submission_not_found');
    if (entry.state !== 'prepared') return get(id, { refresh: false });
    try {
      const descriptor = openSync(paths(id).claim, 'wx', 0o600);
      closeSync(descriptor);
    } catch (error) {
      if (error.code === 'EEXIST') return get(id, { refresh: false });
      throw failure('无法保存提交标记，未提交生成', 'submission_store_unavailable');
    }
    const operation = (async () => {
      entry = update(id, { state: 'submitting', error: null });
      const snapshot = entry.snapshot;
      try {
        const input = {
          signal,
          ...snapshot.params, model: snapshot.model, channelId: snapshot.channelId, prompt: snapshot.prompt,
          references: snapshot.references, generateAudio: snapshot.params.generate_audio ?? snapshot.params.generateAudio,
          providerOptions: snapshot.params.providerOptions || (typeof snapshot.params.watermark === 'boolean' ? { volcengine: { watermark: snapshot.params.watermark } } : undefined),
          idempotencyKey: entry.upstreamKey,
          onDispatch: () => { signal?.throwIfAborted(); update(id, { dispatched: true }); },
          onAccepted: (task) => { if (task?.id) update(id, { task, state: 'accepted' }); },
        };
        const task = await (snapshot.kind === 'video' ? mote.generateVideo(input) : mote.generateImage(input));
        if (!task?.id) throw new Error('上游没有返回任务标识，结果待核实');
        entry = update(id, { task, state: 'accepted', error: null });
      } catch (error) {
        entry = read(id);
        const rejected = error.httpStatus >= 400 && error.httpStatus < 500 && ![408, 409].includes(error.httpStatus);
        const unknown = entry.dispatched && !rejected && !entry.task;
        entry = update(id, {
          state: entry.task ? 'accepted' : unknown ? 'unknown' : 'failed',
          error: entry.task ? null : { code: unknown ? 'submission_unknown' : error.code || 'generation_failed', message: error.message },
        });
      }
      return view(entry);
    })();
    active.set(id, operation);
    try { return await operation; } finally { active.delete(id); }
  }
  function task(id) {
    const entry = read(id);
    if (!entry?.task) throw failure('尚无可用任务收据，请先恢复查询', 'submission_unknown');
    return entry.task;
  }
  async function save(id, options = {}) {
    // Serialize downloads for a receipt; replaying a tool call reuses saved files.
    while (downloads.has(id)) await downloads.get(id);
    const operation = (async () => {
      const entry = read(id);
      if (!entry?.task) throw failure('尚无可用任务收据，请先恢复查询', 'submission_unknown');
      const wanted = (entry.task.artifacts || []).flatMap((artifact, position) =>
        artifact?.state === 'available' && (!options.kinds || options.kinds.includes(artifact.kind)) &&
        (options.artifactIndex === undefined || options.artifactIndex === position) ? [position] : []);
      if (options.artifactIndex !== undefined && (!Number.isInteger(options.artifactIndex) || options.artifactIndex < 0 || options.artifactIndex >= (entry.task.artifacts || []).length)) throw new Error('invalid artifact index');
      let saved = entry.saved || [];
      for (const artifactIndex of wanted) {
        const cached = saved.find((item) => item.artifactIndex === artifactIndex);
        if (cached && !cached.error && existsSync(cached.path)) continue;
        const result = await mote.saveArtifacts(entry.task, { ...options, artifactIndex });
        saved = [...saved.filter((item) => item.artifactIndex !== artifactIndex), ...result.saved];
        update(id, { saved });
      }
      return { dir: mote.resolveOutputDir(), saved: saved.filter((item) => wanted.includes(item.artifactIndex)) };
    })();
    downloads.set(id, operation);
    try { return await operation; } finally { downloads.delete(id); }
  }
  async function cancel(id) {
    const entry = read(id);
    if (!entry?.task?.id) throw failure('尚无可用任务收据', 'submission_unknown');
    const cancelled = await mote.cancelTask(entry.task.id, entry.snapshot.channelId);
    return view(update(id, { task: cancelled, state: 'accepted', error: null }));
  }
  function listChat() {
    if (!existsSync(directory)) return [];
    const entries = [];
    for (const file of readdirSync(directory)) {
      if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
      try {
        const entry = JSON.parse(readFileSync(join(directory, file), 'utf8'));
        if (entry.context?.source === 'chat' && entry.snapshot && entry.id) entries.push(entry);
      } catch { /* one damaged record must not hide other chat works */ }
    }
    return entries.sort((a, b) => b.createdAt - a.createdAt).slice(0, 120).map((entry) => view(entry));
  }
  return { prepare, generate, get, task, save, cancel, listChat };
}
