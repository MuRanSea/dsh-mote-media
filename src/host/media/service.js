import { createChannelRegistry } from '../channels/registry.js';
import { request } from '../channels/request.js';
import { createOpenAiImages } from '../channels/openai-images.js';
import { createMoteDriver } from '../channels/mote.js';
import { createModelCatalog } from './catalog.js';
import { createMediaTasks } from './tasks.js';
import { createArtifactStore } from './artifacts.js';

/** One media instance shared by routes and agent tools for one plugin. */
export function createMote(initialConfig) {
  const modelCache = new Map();
  const localTasks = new Map();
  const registry = createChannelRegistry(initialConfig, () => modelCache.clear());
  const { configure, status, channels, channelById, requireChannel, channelForModel, resolveOutputDir, getConfig } = registry;
  const { listModels, modelInfo, discoverModels } = createModelCatalog({ registry, request, modelCache });
  const { getTask, getTasks, cancelTask, settle, localTask } = createMediaTasks({
    request, enabledChannels: registry.enabledChannels, localTasks, getPollIntervalMs: () => getConfig().pollIntervalMs,
  });
  const { saveArtifacts } = createArtifactStore({ resolveOutputDir });
  const openAi = createOpenAiImages({ request, resolveOutputDir, localTasks });
  const moteDriver = createMoteDriver({ request, settle });

  async function generateImage(input) {
    if (input.n !== undefined && input.n !== 1) throw Object.assign(new Error('每个图片任务只支持单图；多张图片请分别创建独立任务'), { code: 'single_image_required' });
    input = { ...input, n: 1 };
    const catalog = input.catalog || (await listModels({ category: 'image' }));
    const modelId = input.model || getConfig().imageModel || (catalog[0] ? catalog[0].id : '');
    if (modelId === '') throw new Error('no image model is available: set a key and refresh the catalog');
    const selectedChannel = input.channelId || (!input.model ? getConfig().imageChannelId : '');
    const channel = selectedChannel
      ? requireChannel(channelById(selectedChannel))
      : channelForModel(modelId, catalog);

    if (channel.driver === 'openai-images') {
      if (input.references?.length) throw new Error(`channel "${channel.name}" does not support image references`);
      return openAi.generateImage(channel, { ...input, model: modelId });
    }

    return moteDriver.generateImage(channel, { ...input, model: modelId });
  }

  async function generateVideo(input) {
    const catalog = input.catalog || (await listModels({ category: 'video' }));
    const modelId = input.model || getConfig().videoModel || (catalog[0] ? catalog[0].id : '');
    if (modelId === '') throw new Error('no video model is available: set a key and refresh the catalog');
    const selectedChannel = input.channelId || (!input.model ? getConfig().videoChannelId : '');
    const channel = selectedChannel
      ? requireChannel(channelById(selectedChannel))
      : channelForModel(modelId, catalog);
    if (channel.driver !== 'mote') throw new Error(`channel "${channel.name}" cannot generate video`);

    return moteDriver.generateVideo(channel, { ...input, model: modelId });
  }

  return { configure, status, channels, channelById, listModels, discoverModels, modelInfo, generateImage, generateVideo, getTask, getTasks, cancelTask, settle, saveArtifacts, resolveOutputDir, localTask };
}
