import { primaryMedia } from '../../domain/works.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value);

export function callArguments(block) {
  try { const parsed = JSON.parse(block?.argsRaw || block?.call?.argsRaw || '{}'); return object(parsed) ? parsed : {}; } catch { return {}; }
}

function validSingleResult(result) {
  if (!object(result) || (typeof result.submissionId !== 'string' && !object(result.task))) return false;
  if (result.task !== undefined && result.task !== null) {
    const task = result.task;
    if (!object(task) || typeof task.status !== 'string' || task.type === 'video' ||
      (task.model !== undefined && typeof task.model !== 'string') ||
      (task.artifacts !== undefined && (!Array.isArray(task.artifacts) || task.artifacts.some(row => !object(row))))) return false;
  }
  if (result.creation !== undefined && result.creation !== null) {
    const creation = result.creation;
    if (!object(creation) || typeof creation.prompt !== 'string' ||
      (creation.originalPrompt !== undefined && typeof creation.originalPrompt !== 'string') ||
      (creation.params !== undefined && (!object(creation.params) || Object.values(creation.params).some(value => !['string', 'number', 'boolean'].includes(typeof value))))) return false;
  }
  if (result.error !== undefined && result.error !== null && typeof result.error !== 'string') return false;
  if (result.saved !== undefined && (!Array.isArray(result.saved) || result.saved.some(row => !object(row) || (row.error !== undefined && typeof row.error !== 'string')))) return false;
  return true;
}

function validResult(result) {
  if (object(result) && Array.isArray(result.results)) return result.results.length > 0 && result.results.length <= 15
    && result.results.every(validSingleResult) && (result.error === undefined || typeof result.error === 'string');
  return validSingleResult(result);
}

export const individualMediaResults = result => result ? result.results || [result] : [];

/** Read the canonical result content, so replaced outputs cannot revive stale metadata. */
export function readMediaResult(block) {
  if (block?.isError || !Array.isArray(block?.content) || block.content.some(part => part.type !== 'text')) return null;
  for (const part of block.content) {
    if (part.type !== 'text' || typeof part.text !== 'string') continue;
    try {
      const result = JSON.parse(part.text);
      if (validResult(result)) return result;
    } catch { /* preserve unrecognized output in the fallback */ }
  }
  return null;
}

export function extraToolText(block) {
  return (block?.content || []).filter(part => {
    if (part.type !== 'text') return false;
    try { return !validResult(JSON.parse(part.text)); } catch { return true; }
  }).map(part => part.text).join('\n');
}

export function resultFromSubmission(submission) {
  return { submissionId: submission.id, state: submission.state, channelId: submission.channelId,
    task: submission.task, creation: submission.creation, saved: submission.saved || [],
    error: submission.error?.message || null, queryError: submission.queryError || null };
}

function imageUrl(value) {
  if (typeof value !== 'string' || !/^(https?:\/\/|data:image\/|\/api\/mote-media\/asset\?)/i.test(value)) return null;
  return primaryMedia({ type: 'image', artifacts: [{ kind: 'image', state: 'available', url: value }] })?.url || null;
}

export function mediaImages(result) {
  const artifacts = Array.isArray(result?.task?.artifacts) ? result.task.artifacts : [];
  const saved = Array.isArray(result?.saved) ? result.saved : [];
  return artifacts.flatMap((artifact, artifactIndex) => {
    if (!object(artifact) || artifact.kind !== 'image' || artifact.state !== 'available') return [];
    const local = saved.find(row => row && row.artifactIndex === artifactIndex && !row.error && imageUrl(row.url));
    const url = imageUrl(local?.url || artifact.url);
    return url ? [{ artifactIndex, url, path: typeof local?.path === 'string' ? local.path : null }] : [];
  });
}

export function rawToolText(block) {
  if (!Array.isArray(block?.content)) return block?.argsRaw || '';
  return block.content.map(part => part.type === 'text' ? part.text : JSON.stringify(part, null, 2)).join('\n') || block.error?.message || block.error?.code || '';
}

export function mediaStatus(result) {
  return result?.task?.status || ({ unknown: 'submission_unknown', failed: 'failed', prepared: 'prepared', submitting: 'submitting' })[result?.state] || (result?.error ? 'failed' : 'running');
}
