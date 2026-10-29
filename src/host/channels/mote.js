import { randomUUID } from 'node:crypto';
import { compact } from './request.js';
import { toReferences, inlineReferences } from '../media/references.js';

const IMAGE_PATH = '/media/v1/images/generations';
const VIDEO_PATH = '/media/v1/videos/generations';

export function createMoteDriver({ request, settle }) {
  function clampWait(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(50, Math.max(0, Math.trunc(value)));
  }

  async function generateImage(channel, input) {
    const modelId = input.model;
    const prepared = await inlineReferences(toReferences(input.references), input.signal);
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
    await input.onDispatch?.();
    const task = await request(channel, IMAGE_PATH, {
      method: 'POST',
      body,
      idempotencyKey: input.idempotencyKey || randomUUID(),
      retries: 0,
      signal: input.signal,
      timeoutMs: 90000,
    });
    await input.onAccepted?.(task);
    const settled = await settle(task, input.waitSeconds ?? 60, channel, input.signal);
    if (settled && prepared.inlined > 0) settled.inlined = prepared.inlined;
    return settled;
  }

  async function generateVideo(channel, input) {
    const modelId = input.model;
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
    await input.onDispatch?.();
    const task = await request(channel, VIDEO_PATH, {
      method: 'POST',
      body,
      idempotencyKey: input.idempotencyKey || randomUUID(),
      retries: 0,
      timeoutMs: 90000,
    });
    await input.onAccepted?.(task);
    const settled = await settle(task, input.waitSeconds ?? 0, channel);
    if (settled && prepared.inlined > 0) settled.inlined = prepared.inlined;
    return settled;
  }

  return { generateImage, generateVideo };
}
