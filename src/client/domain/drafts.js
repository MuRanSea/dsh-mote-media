import { modelById, modelValue, referenceRoles } from './model-capabilities.js';

export const emptyDraft = () => ({ modelId: null, params: {}, imageCount: 1, prompt: '', refs: [], frames: { first: null, last: null }, unhandledReferences: [], notice: '', epoch: 0 });

/** Missing legacy inputs stay explicit; unavailable channels never fall back. */
export function draftFromWork(item, snapshot, models) {
  const input = snapshot || { kind: item.type, channelId: item.channelId, model: item.model, prompt: item.prompt, params: item.params };
  if (!['image', 'video'].includes(input.kind)) throw new Error('Invalid work type');
  const selected = modelById(models, input.kind, input.model, input.channelId);
  const draft = { ...emptyDraft(), modelId: selected ? modelValue(selected) : modelValue({ id: input.model || '', channelId: input.channelId || '' }),
    prompt: input.prompt || '', params: { ...input.params }, notice: snapshot ? 'editRestoredHint' : 'editLegacyHint' };
  if (input.kind === 'image') draft.params.n = 1;
  for (const reference of input.references || []) {
    const asset = { url: reference.url, name: reference.name || reference.role };
    if (reference.type !== 'image' || !reference.url) draft.unhandledReferences.push({ ...reference });
    else if (reference.role === 'reference') draft.refs.push(asset);
    else if (input.kind === 'video' && reference.role === 'first_frame' && !draft.frames.first) draft.frames.first = asset;
    else if (input.kind === 'video' && reference.role === 'last_frame' && !draft.frames.last) draft.frames.last = asset;
    else draft.unhandledReferences.push({ ...reference });
  }
  return { type: input.kind, draft };
}

export function referenceIssue(draft, model, type) {
  const roles = referenceRoles(model);
  return draft.unhandledReferences?.length || draft.refs.length > roles.referenceLimit || (draft.refs.length && !roles.reference)
    || (draft.frames.first && (type !== 'video' || !roles.firstFrame)) || (draft.frames.last && (type !== 'video' || !roles.lastFrame))
    ? 'referenceUnsupported' : '';
}

/** Uploads choose a slot explicitly; work reuse only fills a free slot. */
export function referencePlacement(draft, model, type, reference, requested = 'auto') {
  if (reference.type !== 'image' || typeof reference.url !== 'string' || !reference.url || /^data:(?!image\/)/i.test(reference.url)) return { error: 'referenceImageOnly' };
  const issue = referenceIssue(draft, model, type);
  if (issue) return { error: issue };
  const roles = referenceRoles(model);
  let slot = requested;
  if (slot === 'auto') {
    if (type === 'video' && roles.firstFrame && !draft.frames.first) slot = 'first';
    else if (type === 'video' && roles.lastFrame && !draft.frames.last) slot = 'last';
    else if (roles.reference) slot = 'reference';
    else return { error: roles.firstFrame || roles.lastFrame ? 'framesFull' : 'referenceUnsupported' };
  }
  if (slot === 'reference') {
    if (!roles.reference) return { error: 'referenceUnsupported' };
    if (draft.refs.length >= roles.referenceLimit) return { error: 'refsFull' };
  } else if (type !== 'video' || (slot === 'first' ? !roles.firstFrame : slot !== 'last' || !roles.lastFrame)) return { error: 'referenceUnsupported' };
  const asset = { url: reference.url, name: reference.name };
  const next = slot === 'reference' ? { ...draft, refs: [...draft.refs, asset] } : { ...draft, frames: { ...draft.frames, [slot]: asset } };
  const total = [...next.refs, next.frames.first, next.frames.last].filter(Boolean).reduce((sum, entry) => sum + entry.url.length, 0);
  return total > 3600000 ? { error: 'referencesTooLarge' } : { slot, draft: next };
}
