/** Task and artifact rules; translation is supplied by the caller. */
const PENDING = new Set(['queued', 'running', 'reconciling', 'submitting', 'submission_unknown', 'prepared']);

export function newId() {
  return globalThis.crypto?.randomUUID?.() || `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

export const isPending = (item) => PENDING.has(item.status);

export function statusLabel(status, translate) {
  if (status === 'queued') return translate('queued');
  if (status === 'running') return translate('running');
  if (status === 'succeeded') return translate('succeeded');
  if (status === 'failed') return translate('failed');
  if (status === 'reconciling') return translate('reconciling');
  if (status === 'cancelled') return translate('cancelled');
  if (status === 'submitting') return translate('submitting');
  if (status === 'submission_unknown') return translate('submissionUnknown');
  if (status === 'prepared') return translate('prepared');
  return status || '';
}

/**
 * A task returns the product plus, for videos, a `cover` and a `last_frame`.
 * Pick by the card's own medium so a video tile never shows its poster.
 */
const ASSET = '/api/mote-media/asset';

/** Same classification as the Host: loopback, LAN, and CGNAT addresses. */
function isNonPublicUrl(value) {
  if (typeof value !== 'string' || value === '' || value.startsWith('data:')) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === '' || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '0.0.0.0' || host === '::' || host === '::1') return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(host);
}

export function primaryMedia(item) {
  const artifacts = Array.isArray(item.artifacts) ? item.artifacts : [];
  const usable = artifacts.filter(
    (artifact) => artifact && artifact.state === 'available' && typeof artifact.url === 'string',
  );
  if (usable.length === 0) return null;
  const wanted = item.type === 'video' ? 'video' : 'image';
  const indexed = Number.isInteger(item.artifactIndex) ? artifacts[item.artifactIndex] : null;
  const picked = Number.isInteger(item.artifactIndex)
    ? usable.includes(indexed) ? indexed : null
    : usable.find((artifact) => artifact.kind === wanted) || usable.find((artifact) => artifact.kind === 'image') || usable[0];
  if (!picked) return null;
  const video =
    picked.kind === 'video' || (typeof picked.mimeType === 'string' && picked.mimeType.startsWith('video/'));
  const expiry = typeof picked.expiresAt === 'string' ? Date.parse(picked.expiresAt) : NaN;
  // A LAN artifact is fetched by the Host and streamed back, so the page does
  // not need to reach the gateway's private address.
  const local = item.saved?.find((entry) => entry.artifactIndex === artifacts.indexOf(picked) && !entry.error && entry.url);
  const source = local?.url || picked.url;
  const display = isNonPublicUrl(source) ? `${ASSET}?url=${encodeURIComponent(source)}` : source;
  return { url: display, source, video, expiresAt: local ? null : Number.isFinite(expiry) ? expiry : null };
}

function groupKey(item) {
  return item.submissionId || (item.taskId ? JSON.stringify([item.channelId || '', item.taskId]) : item.groupId || item.id);
}

/** One card per primary output, excluding video cover/last-frame artifacts. */
export function normalizeWorks(items) {
  const groups = new Map();
  for (const item of items) {
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()].flatMap((siblings) => {
    const base = siblings[0];
    const groupId = base.groupId || base.id;
    const hiddenArtifacts = [...new Set(siblings.flatMap((item) => item.hiddenArtifacts || []))];
    const artifacts = Array.isArray(base.artifacts) ? base.artifacts : [];
    const outputs = artifacts.flatMap((artifact, position) => artifact && artifact.kind === base.type && artifact.state === 'available' && artifact.url && !hiddenArtifacts.includes(position) ? [position] : []);
    if (outputs.length === 0) return [{ ...base, groupId, hiddenArtifacts }];
    return outputs.map((position, index) => ({
      ...base, id: index === 0 ? groupId : `${groupId}-${position}`, groupId, hiddenArtifacts, artifactIndex: position,
    }));
  });
}

export function mergeWorkTask(items, taskId, task, channelId) {
  return normalizeWorks(items.map((item) => {
    if (item.taskId !== taskId || (channelId && item.channelId && item.channelId !== channelId)) return item;
    if (['succeeded', 'failed', 'cancelled'].includes(item.status) && PENDING.has(task.status)) return item;
    return { ...item, taskId: task.id || taskId, model: task.model || item.model, status: task.status || item.status,
      progress: task.progress ?? item.progress, artifacts: task.artifacts?.length ? task.artifacts : item.artifacts,
      error: task.error ?? null, billing: task.billing ?? item.billing ?? null, requestId: task.requestId ?? item.requestId ?? null };
  }));
}

export function removeWork(items, target) {
  const key = groupKey(target);
  return items.filter((item) => item.id !== target.id).map((item) => groupKey(item) === key
    ? { ...item, hiddenArtifacts: [...new Set([...(item.hiddenArtifacts || []), target.artifactIndex])] } : item);
}

export function mergeSubmissionWorks(items, submission) {
  return normalizeWorks(items.map((item) => {
    if (item.submissionId !== submission.id) return item;
    const task = submission.task;
    if (['succeeded', 'failed', 'cancelled'].includes(item.status) && (!task || PENDING.has(task.status))) return item;
    return { ...item, channelId: submission.channelId || item.channelId, snapshotAvailable: submission.snapshotAvailable === true,
      ...(submission.saved ? { saved: submission.saved } : {}),
      status: task?.status || ({ prepared: 'prepared', submitting: 'submitting', unknown: 'submission_unknown', failed: 'failed' })[submission.state] || item.status,
      taskId: task?.id || item.taskId, model: task?.model || item.model,
      progress: task?.progress ?? item.progress, artifacts: task?.artifacts?.length ? task.artifacts : item.artifacts,
      error: task?.error || submission.error || null, billing: task?.billing ?? item.billing ?? null,
      requestId: task?.requestId ?? item.requestId ?? null, recoveryRequired: submission.state === 'unknown', queryError: submission.queryError || null,
    };
  }));
}

/** Import recent chat receipts without reviving locally removed outputs. */
export function mergeChatWorks(items, submissions, hidden = new Set()) {
  const receipts = submissions.filter((entry) => entry?.source === 'chat' && typeof entry.id === 'string' && !hidden.has(entry.id));
  const known = new Set(items.map(item => item.submissionId));
  let next = [...items, ...receipts.filter(entry => !known.has(entry.id)).map(entry => ({
    id: entry.id, groupId: entry.id, submissionId: entry.id, source: 'chat', type: entry.kind,
    channelId: entry.channelId, model: entry.model, prompt: entry.creation?.prompt || '',
    originalPrompt: entry.creation?.originalPrompt || '', params: entry.creation?.params || {},
    createdAt: entry.createdAt, status: 'submitting', artifacts: [],
  }))];
  for (const receipt of receipts) next = mergeSubmissionWorks(next, receipt);
  return next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export const canRegenerate = (item) => Boolean(item.submissionId && item.snapshotAvailable && ['succeeded', 'failed', 'cancelled'].includes(item.status));

export function downloadOutcome(result) {
  const saved = Array.isArray(result.saved) ? result.saved : [];
  const failed = saved.filter((entry) => !entry.path || Object.hasOwn(entry, 'error'));
  return { succeeded: saved.length - failed.length, failed };
}

/** Everything support asks for when a task fails without a captured reason. */
export function diagnosticsOf(item) {
  return JSON.stringify(
    {
      type: item.type,
      model: item.model,
      task: item.taskId || null,
          submission: item.submissionId || null,
          channel: item.channelId || null,
          artifactIndex: item.artifactIndex ?? null,
      request: item.requestId || null,
      status: item.status,
      error: item.error || null,
      billing: item.billing || null,
      prompt: item.prompt || '',
      params: item.params || {},
    },
    null,
    2,
  );
}
