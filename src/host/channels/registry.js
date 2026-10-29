import { homedir } from 'node:os';
import { join } from 'node:path';
import { normalizeConfig } from '../config/normalize.js';

export const DEFAULT_OUTPUT_DIR = join(homedir(), 'Pictures', 'mote-media');

export function createChannelRegistry(initialConfig, onConfigure) {
  const state = { config: normalizeConfig(initialConfig) };

  function configure(patch) {
    state.config = normalizeConfig({ ...state.config, ...(patch || {}) });
    onConfigure();
    return state.config;
  }

  function resolveOutputDir(override) {
    const dir = typeof override === 'string' && override.trim() !== '' ? override.trim() : state.config.outputDir;
    return dir === '' ? DEFAULT_OUTPUT_DIR : dir;
  }

  function channels({ includeSecrets = false } = {}) {
    return state.config.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      driver: channel.driver,
      baseUrl: channel.baseUrl,
      models: channel.models.slice(),
      enabled: channel.enabled,
      configured: channel.apiKey !== '',
      ...(includeSecrets ? { apiKey: channel.apiKey } : {}),
    }));
  }

  function channelById(id) {
    if (typeof id === 'string' && id !== '') {
      return state.config.channels.find((channel) => channel.id === id || channel.name === id);
    }
    return undefined;
  }

  function enabledChannels() {
    return state.config.channels.filter((channel) => channel.enabled && channel.apiKey !== '');
  }

  function requireChannel(channel) {
    if (!channel) throw new Error('no such channel: configure it in Channel settings');
    if (channel.apiKey === '') throw new Error(`channel "${channel.name}" has no API key`);
    if (!channel.enabled) throw new Error(`channel "${channel.name}" is disabled`);
    return channel;
  }

  function channelForModel(modelId, known) {
    const hits = known.filter((row) => row.id === modelId);
    if (hits.length > 1) throw new Error(`model "${modelId}" exists in multiple channels; pass a channel explicitly`);
    const hit = hits[0];
    if (hit) return requireChannel(channelById(hit.channelId));
    const enabled = enabledChannels();
    if (enabled.length === 1) return enabled[0];
    if (enabled.length === 0) throw new Error('no channel is configured with an API key');
    throw new Error(`model "${modelId}" is not in any channel catalog; pass a channel explicitly`);
  }

  function status() {
    return {
      configured: enabledChannels().length > 0,
      channels: channels(),
      imageModel: state.config.imageModel,
      videoModel: state.config.videoModel,
      imageChannelId: state.config.imageChannelId,
      videoChannelId: state.config.videoChannelId,
      outputDir: resolveOutputDir(),
      pollIntervalMs: state.config.pollIntervalMs,
    };
  }

  return { configure, resolveOutputDir, channels, channelById, enabledChannels, requireChannel, channelForModel, status, getConfig: () => state.config };
}
