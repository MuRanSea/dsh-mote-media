import { trimTask, summarize } from '../media/task-view.js';
import { PENDING_STATUSES } from '../media/tasks.js';
import { createImageWorkflow, mediaPresentation } from './image-workflow.js';

const textBlocks = (text) => [{ type: 'text', text }];
const asText = (value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2));

export function registerTools(ctx, mote, submissions) {
  const images = createImageWorkflow(mote, submissions);
  const register = (definition) => {
    // DSH canonical outputs must be lossless JSON, including legacy task fields.
    const execute = async (...args) => JSON.parse(JSON.stringify(await definition.execute(...args)));
    ctx.effect(() => ctx.tools.register({ ...definition, execute }), `mote-media: ${definition.name}`);
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
        const state = mote.status();
        return { models, channels: mote.channels(), defaults: {
          image: { model: state.imageModel, channel: state.imageChannelId },
          video: { model: state.videoModel, channel: state.videoChannelId },
        } };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  register({
    name: 'mote_image',
    description:
      'Generate or edit images and display them in chat. Use the mote-image skill to enrich short prompts and choose supported model/resolution/aspect ratio from mote_models. Preserve explicit user requirements. n means independent single-image tasks, each with a durable submissionId; poll each id with mote_media_task instead of generating again. Saves images by default.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to draw; required by every image model.' },
        original_prompt: { type: 'string', description: 'Original user request before prompt enrichment, retained alongside the actual prompt.' },
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
        n: { type: 'integer', minimum: 1, maximum: 15, description: 'Number of independent single-image requests (default 1). n=4 creates four separate tasks, each sent upstream with n=1. This plugin count also works with models that only support one image per request. This does not enable related-image groups.' },
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
          description: 'Single-image wait budget (default 50 seconds). For n>1, return task receipts without waiting; query each submissionId with mote_media_task.',
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
          submissionId: { type: 'string' },
          state: { type: 'string' },
          creation: { type: 'object' },
          saved: { type: 'array', items: { type: 'object' } },
          results: { type: 'array', description: 'For n>1, individual task results with their own submissionId, state, task, creation, saved and error.', items: { type: 'object' } },
          summary: { type: 'string' },
          error: { type: 'string' },
        },
      },
      render: (_args, value) => textBlocks(asText(value)),
      presentationMeta: mediaPresentation,
    },
    async execute(args, exec) {
      return images.generate(args, exec);
    },
    timeoutMs: 240000,
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
      'Inspect, cancel, or download an existing media generation. Prefer submission_id from mote_image (its submissionId); it restores the correct channel and saves completed images. Use task_id for legacy video/image tasks. Unknown submissions must be recovered, never generated again.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'cancel', 'download'], description: 'Operation to perform.' },
        task_id: { type: 'string', description: 'Task id returned by mote_image or mote_video.' },
        submission_id: { type: 'string', description: 'Durable submissionId returned by mote_image; use this instead of task_id for image skills.' },
        channel: { type: 'string', description: 'Original channel id for a legacy task_id.' },
        wait_seconds: {
          type: 'integer',
          minimum: 0,
          maximum: 600,
          description: 'For status: keep polling up to this many seconds while the task is still running.',
        },
      },
      required: ['action'],
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
      presentationMeta: mediaPresentation,
    },
    async execute(args, exec) {
      try {
        if (args?.submission_id) {
          if (args.task_id) return { error: 'Use either submission_id or task_id, not both' };
          return await images.inspect(args, exec);
        }
        const id = typeof args?.task_id === 'string' ? args.task_id.trim() : '';
        if (id === '') return { error: 'submission_id or task_id is required' };
        if (args?.action === 'cancel') {
          const task = await mote.cancelTask(id, args.channel);
          return { task: trimTask(task), summary: summarize(task) };
        }
        const waitSeconds = Number.isFinite(args?.wait_seconds) ? args.wait_seconds : 0;
        let task = await mote.getTask(id, args.channel);
        if (PENDING_STATUSES.has(task.status) && waitSeconds > 0) {
          const deadline = Date.now() + waitSeconds * 1000;
          while (PENDING_STATUSES.has(task.status) && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
            task = await mote.getTask(id, args.channel);
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
