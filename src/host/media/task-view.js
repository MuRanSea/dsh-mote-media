import { PENDING_STATUSES } from './tasks.js';

export function trimTask(task) {
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

export function summarize(task) {
  if (!task || typeof task !== 'object') return 'no task';
  const head = `${task.model ?? 'model'} ${task.type ?? ''} ${task.id ?? ''} → ${task.status ?? 'unknown'}`;
  if (task.error && typeof task.error.message === 'string') return `${head} (${task.error.message})`;
  const count = Array.isArray(task.artifacts) ? task.artifacts.filter((a) => a.state === 'available').length : 0;
  if (count > 0) return `${head}, ${count} artifact(s) ready`;
  if (PENDING_STATUSES.has(task.status)) return `${head}, still generating`;
  return head;
}
