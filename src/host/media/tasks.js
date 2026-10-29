import { messageOf } from '../channels/request.js';
import { setTimeout as delay } from 'node:timers/promises';

export const PENDING_STATUSES = new Set(['queued', 'running', 'reconciling']);

export function createMediaTasks({ request, enabledChannels, localTasks, getPollIntervalMs }) {
  function localTask(id) {
    const hit = localTasks.get(id);
    return hit ? hit.task : undefined;
  }

  async function getTask(id, channelId, signal) {
    signal?.throwIfAborted();
    if (typeof id !== 'string' || id.trim() === '') throw new Error('task id is required');
    const local = localTask(id.trim());
    if (local) return local;
    const taskId = id.trim();
    const candidates = enabledChannels().filter((channel) => channel.driver === 'mote' && (!channelId || channel.id === channelId));
    if (candidates.length === 0) throw new Error('no mote channel is configured');
    let lastError = null;
    for (const channel of candidates) {
      try {
        return await request(channel, `/media/v1/tasks/${encodeURIComponent(taskId)}`, { signal });
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

  async function cancelTask(id, channelId) {
    if (typeof id !== 'string' || id.trim() === '') throw new Error('task id is required');
    if (localTask(id.trim())) throw new Error('local results cannot be cancelled');
    const taskId = id.trim();
    const candidates = enabledChannels().filter((channel) => channel.driver === 'mote' && (!channelId || channel.id === channelId));
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

  async function settle(task, waitSeconds, channel, signal) {
    if (!task || typeof task.id !== 'string') return task;
    if (!PENDING_STATUSES.has(task.status)) return task;
    const budgetMs = Math.max(0, waitSeconds) * 1000;
    if (budgetMs === 0) return task;
    const deadline = Date.now() + budgetMs;
    let current = task;
    while (PENDING_STATUSES.has(current.status) && Date.now() < deadline) {
      await delay(Math.min(getPollIntervalMs(), Math.max(0, deadline - Date.now())), undefined, { signal });
      try {
        current = channel
          ? await request(channel, `/media/v1/tasks/${encodeURIComponent(task.id)}`, { signal })
          : await getTask(task.id, undefined, signal);
      } catch {
        break;
      }
    }
    return current;
  }

  return { localTask, getTask, getTasks, cancelTask, settle };
}
