import { DRIVERS, trimBase } from '../config/normalize.js';
import { openAiCatalog, openAiModelsPath, IMAGE_ID_HINTS } from '../channels/openai-images.js';
import { parseBody, platformError, messageOf } from '../channels/request.js';

const MODELS_TTL_MS = 5 * 60 * 1000;

export function createModelCatalog({ registry, request, modelCache }) {
  const { channelById, requireChannel, enabledChannels } = registry;

  async function listModels({ category, refresh = false, channelId, signal } = {}) {
    const rows = [];
    const targets = channelId ? [requireChannel(channelById(channelId))] : enabledChannels();
    for (const channel of targets) {
      signal?.throwIfAborted();
      if (channel.driver === 'openai-images') {
        for (const model of openAiCatalog(channel)) rows.push(model);
        continue;
      }
      const cached = modelCache.get(channel.id);
      const fresh = cached && Date.now() - cached.at < MODELS_TTL_MS;
      if (!fresh || refresh) {
        const data = await request(channel, '/media/v1/models', { signal });
        const list = data && Array.isArray(data.data) ? data.data : [];
        modelCache.set(channel.id, { at: Date.now(), rows: list });
      }
      const cachedRows = modelCache.get(channel.id);
      for (const row of (cachedRows ? cachedRows.rows : [])) {
        rows.push({
          id: row.id,
          channelId: channel.id,
          channelName: channel.name,
          driver: channel.driver,
          type: row.type,
          provider: row.provider,
          sync: row.sync === true,
          supportsCancel: row.supports_cancel === true,
          parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : {},
          references: Array.isArray(row.references) ? row.references : [],
          providerOptions: row.provider_options_schema ?? null,
        });
      }
    }
    return typeof category === 'string' && category !== '' ? rows.filter((row) => row.type === category) : rows;
  }

  function modelInfo(models, modelId) {
    return models.find((row) => row.id === modelId) || null;
  }

  async function discoverModels({ driver, baseUrl, apiKey, channelId } = {}) {
    const stored = channelId ? channelById(channelId) : undefined;
    const effectiveDriver = DRIVERS.includes(driver) ? driver : (stored && stored.driver) || 'mote';
    const effectiveBase = trimBase(baseUrl) || (stored && stored.baseUrl) || '';
    const effectiveKey = String(apiKey || '').trim() || (stored ? stored.apiKey : '');
    if (effectiveBase === '') throw new Error('base URL is required');
    if (effectiveKey === '') throw new Error('API key is required');
    const url = effectiveDriver === 'mote' ? `${effectiveBase}/media/v1/models` : effectiveBase + openAiModelsPath(effectiveBase);
    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${effectiveKey}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      throw new Error(`${url} · ${messageOf(error)}`);
    }
    const text = await response.text();
    const data = parseBody(text);
    if (!response.ok) throw platformError(response.status, data);
    const rows = data && Array.isArray(data.data) ? data.data : [];
    const models = rows
      .map((row) => {
        const id = String((row && row.id) || '').trim();
        if (id === '') return null;
        const type = row && typeof row.type === 'string' ? row.type : IMAGE_ID_HINTS.test(id) ? 'image' : 'other';
        return { id, type };
      })
      .filter(Boolean);
    return {
      url,
      models,
      image: models.filter((row) => row.type === 'image').map((row) => row.id),
      video: models.filter((row) => row.type === 'video').map((row) => row.id),
    };
  }

  return { listModels, modelInfo, discoverModels };
}
