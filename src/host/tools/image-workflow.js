import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { PENDING_STATUSES } from '../media/tasks.js';
import { summarize } from '../media/task-view.js';

const PARAMS = ['resolution', 'aspect_ratio', 'size', 'output_format'];
const fail = (message, code = 'invalid_image_settings') => Object.assign(new Error(message), { code });
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

function imageParams(args, model) {
  if (args.size && args.aspect_ratio) throw fail('size 与 aspect_ratio 只能选择一个');
  const specs = model.parameters || {};
  const known = Object.keys(specs).length > 0;
  const params = {};
  for (const key of PARAMS) {
    const explicit = args[key] !== undefined;
    if (!explicit && ((key === 'aspect_ratio' && args.size) || (key === 'size' && args.aspect_ratio))) continue;
    const spec = specs[key];
    const value = explicit ? args[key] : spec?.default;
    if (value === undefined || value === null || value === '') continue;
    if (known && !spec) throw fail(`模型 ${model.id} 未声明支持 ${key}，请按 mote_models 选择参数`);
    if (spec?.enum && !spec.enum.includes(value)) throw fail(`${key} 必须是 ${spec.enum.join(' / ')}`);
    if (spec?.type === 'integer' && !Number.isInteger(value)) throw fail(`${key} 必须是整数`);
    if ((spec?.minimum !== undefined && value < spec.minimum) || (spec?.maximum !== undefined && value > spec.maximum)) throw fail(`${key} 超出模型支持范围`);
    params[key] = value;
  }
  if (params.size && params.aspect_ratio) delete params.aspect_ratio;
  if (params.size === params.resolution) delete params.resolution;
  if (typeof args.watermark === 'boolean') params.watermark = args.watermark;
  return { ...params, n: 1 };
}

function referencesFor(args, model) {
  const references = Array.isArray(args.references) ? args.references : [];
  if (!references.length) return [];
  const spec = model.references?.find(row => row.role === 'reference' && row.types?.includes('image'));
  if (!spec || references.length > (spec.max_count ?? 1)) throw fail('该模型不支持这些参考图，请按 mote_models 选择支持参考图的模型');
  return references.map(value => {
    if (typeof value !== 'string' || !value.trim()) throw fail('参考图标识不能为空');
    const source = value.trim();
    return { role: 'reference', type: 'image', ...(/^(https?:|data:image\/|\/api\/mote-media\/asset\?)/.test(source) ? { url: source } : { file_id: source }) };
  });
}

/** Agent image calls share the panel's durable intent/receipt mechanism. */
export function createImageWorkflow(mote, submissions) {
  async function result(id, { save = false, signal } = {}) {
    signal?.throwIfAborted();
    let receipt = await submissions.get(id, { refresh: false });
    if (save && receipt.task?.status === 'succeeded') {
      try { await submissions.save(id, { kinds: ['image'], signal }); }
      catch (error) { signal?.throwIfAborted(); return { ...envelope(receipt), saveError: error.message }; }
      receipt = await submissions.get(id, { refresh: false });
    }
    return envelope(receipt);
  }
  async function generate(args = {}, exec) {
    const id = exec?.callId ? `chat-${hash([exec.agent?.id || '', exec.callId])}` : `chat-${randomUUID()}`;
    const ids = [];
    try {
      exec?.signal?.throwIfAborted();
      const requested = args.n === undefined ? 1 : args.n;
      if (!Number.isInteger(requested) || requested < 1 || requested > 15) throw fail('n 必须是 1 到 15 的整数，表示独立单图任务数');
      const requestHash = hash(args);
      let existing;
      try { existing = await submissions.get(id, { refresh: false, includeContext: true, includeSnapshot: true }); }
      catch (error) { if (error.code !== 'submission_not_found') throw error; }
      if (!existing) {
        if (typeof args.prompt !== 'string' || !args.prompt.trim()) throw fail('prompt 不能为空');
        const catalog = await mote.listModels({ category: 'image', signal: exec?.signal });
        const defaults = mote.status();
        const channel = args.channel ? mote.channelById(args.channel)?.id : !args.model ? defaults.imageChannelId : '';
        if (args.channel && !channel) throw fail('指定的渠道不存在', 'channel_unavailable');
        const modelId = args.model || defaults.imageModel || catalog.find(row => !channel || row.channelId === channel)?.id;
        const hits = catalog.filter(row => row.id === modelId && (!channel || row.channelId === channel));
        if (hits.length !== 1) throw fail(hits.length > 1 ? '模型存在于多个渠道，请明确指定 channel' : '模型不可用，请先调用 mote_models 选择模型', 'model_unavailable');
        const model = hits[0];
        const params = imageParams(args, model);
        const references = referencesFor(args, model);
        exec?.signal?.throwIfAborted();
        submissions.prepare(id, {
          kind: 'image', channelId: model.channelId, model: model.id, prompt: args.prompt,
          originalPrompt: typeof args.original_prompt === 'string' ? args.original_prompt : args.prompt,
          params: { ...params, waitSeconds: requested > 1 ? 0 : Number.isFinite(args.wait_seconds) ? args.wait_seconds : 50 }, references,
        }, { source: 'chat', requestHash, autoSave: args.save !== false, requestCount: requested });
        existing = await submissions.get(id, { refresh: false, includeContext: true, includeSnapshot: true });
      }
      if (existing.context?.requestHash !== requestHash) throw fail('同一工具调用不能用于不同输入', 'submission_conflict');
      // Older receipts represent one provider attempt. Replaying them must not
      // reinterpret their old n parameter as authorization for additional tasks.
      const count = existing.context?.requestCount || 1;
      for (let index = 0; index < count; index += 1) {
        exec?.signal?.throwIfAborted();
        const childId = index ? `${id}-${index + 1}` : id;
        if (index) {
          let child;
          try { child = await submissions.get(childId, { refresh: false, includeContext: true }); }
          catch (error) { if (error.code !== 'submission_not_found') throw error; }
          if (child && child.context?.requestHash !== requestHash) throw fail('同一工具调用不能用于不同输入', 'submission_conflict');
          if (!child) submissions.prepare(childId, existing.snapshot, { ...existing.context, requestIndex: index + 1 });
        }
        ids.push(childId);
      }
      // All intents are durable before any dispatch. Each child owns its claim,
      // receipt and downloads, so unknown results are never submitted again.
      const results = [];
      for (const childId of ids) {
        exec?.signal?.throwIfAborted();
        try {
          await submissions.generate(childId, { signal: exec?.signal });
          results.push(await result(childId, { save: existing.context?.autoSave === true, signal: exec?.signal }));
        } catch (error) {
          exec?.signal?.throwIfAborted();
          let receipt = {};
          try { receipt = await result(childId); } catch { /* keep the recovery id even if storage is unavailable */ }
          results.push({ ...receipt, submissionId: childId, error: error.message, code: error.code || 'image_generation_failed' });
        }
      }
      return count === 1 ? results[0] : { results, summary: `${count} independent single-image tasks. Check each submissionId for its result.` };
    } catch (error) {
      exec?.signal?.throwIfAborted();
      if (ids.length) {
        const results = [];
        for (const childId of ids) {
          try { results.push(await result(childId)); }
          catch { results.push({ submissionId: childId, error: error.message, code: error.code }); }
        }
        return { results, error: error.message, code: error.code || 'image_generation_failed' };
      }
      return { error: error.message, code: error.code || 'image_generation_failed', submissionId: id };
    }
  }
  async function inspect(args, exec) {
    exec?.signal?.throwIfAborted();
    const id = args.submission_id;
    if (args.action === 'cancel') return envelope(await submissions.cancel(id));
    const budget = Math.max(0, Math.min(600, Number(args.wait_seconds) || 0)) * 1000;
    const deadline = Date.now() + budget;
    let receipt = await submissions.get(id, { includeContext: true, signal: exec?.signal });
    while (PENDING_STATUSES.has(receipt.task?.status) && Date.now() < deadline && !receipt.queryError) {
      await delay(Math.min(3000, deadline - Date.now()), undefined, { signal: exec?.signal });
      receipt = await submissions.get(id, { includeContext: true, signal: exec?.signal });
    }
    if (args.action === 'download') {
      await submissions.save(id, { signal: exec?.signal });
      return result(id, { signal: exec?.signal });
    }
    const output = await result(id, { save: receipt.context?.autoSave === true, signal: exec?.signal });
    return { ...output, ...(receipt.queryError ? { queryError: receipt.queryError } : {}) };
  }
  return { generate, inspect };
}

function envelope(receipt) {
  return {
    submissionId: receipt.id, state: receipt.state, channelId: receipt.channelId,
    ...(receipt.task ? { task: receipt.task } : {}),
    ...(receipt.creation ? { creation: receipt.creation } : {}), saved: receipt.saved || [],
    summary: receipt.task ? summarize(receipt.task) : receipt.error?.message || receipt.state,
    ...(receipt.error ? { error: receipt.error.message, code: receipt.error.code } : {}),
  };
}

/** Persist only presentation facts; reference bytes never enter the chat card. */
export function mediaPresentation(_args, value) {
  if (Array.isArray(value?.results)) return { moteMedia: { version: 1, results: value.results.map(row => mediaPresentation(null, row)?.moteMedia).filter(Boolean) } };
  if (!value || (!value.task && !value.submissionId)) return null;
  const images = (value.task?.artifacts || []).flatMap((artifact, artifactIndex) => {
    if (artifact.kind !== 'image' || artifact.state !== 'available' || !artifact.url) return [];
    const local = value.saved?.find(row => row.artifactIndex === artifactIndex && !row.error && row.url);
    return [{ artifactIndex, url: local?.url || artifact.url, path: local?.path || null, mimeType: artifact.mimeType || null }];
  });
  return JSON.parse(JSON.stringify({ moteMedia: { version: 1, ...value, images } }));
}
