import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { trimBase } from '../config/normalize.js';
import { compact } from './request.js';
import { sniffMime, extensionFor, artifactUrlFor } from '../media/artifacts.js';

export function openAiImagesPath(baseUrl) {
  return /\/v1$/i.test(trimBase(baseUrl)) ? '/images/generations' : '/v1/images/generations';
}

export function openAiModelsPath(baseUrl) {
  return /\/v1$/i.test(trimBase(baseUrl)) ? '/models' : '/v1/models';
}

export const IMAGE_ID_HINTS = /(image|dall-?e|flux|stable-?diffusion|sd3|sdxl|seedream|imagen|nano-?banana|gpt-image|midjourney|kolors|ideogram|recraft|playground|kling|seedance|wan|hunyuan)/i;

export function openAiCatalog(channel) {
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

export function createOpenAiImages({ request, resolveOutputDir, localTasks }) {
  async function generateOpenAiImage(channel, input) {
    const body = compact({
      model: input.model,
      prompt: input.prompt,
      n: Number.isFinite(input.n) ? input.n : undefined,
      size: input.size,
      response_format: undefined,
    });
    await input.onDispatch?.();
    const data = await request(channel, openAiImagesPath(channel.baseUrl), {
      method: 'POST',
      body,
      timeoutMs: 180000,
      retries: 0,
      signal: input.signal,
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
    localTasks.set(taskId, { task, channelId: channel.id, at: Date.now() });
    await input.onAccepted?.(task);
    return task;
  }

  return { generateImage: generateOpenAiImage };
}
