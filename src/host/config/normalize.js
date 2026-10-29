export const DRIVERS = ['mote', 'openai-images'];

export function trimBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function channelIdOf(index) {
  return `ch${index + 1}`;
}

export function normalizeChannel(raw, index = 0) {
  if (raw === null || typeof raw !== 'object') return undefined;
  const driver = DRIVERS.includes(raw.driver) ? raw.driver : 'mote';
  const baseUrl = trimBase(raw.baseUrl) || (driver === 'mote' ? 'https://platform.sgt.site' : '');
  if (baseUrl === '') return undefined;
  const models = Array.isArray(raw.models)
    ? raw.models.filter((item) => typeof item === 'string' && item.trim() !== '').map((item) => item.trim())
    : [];
  return {
    id: typeof raw.id === 'string' && raw.id.trim() !== '' ? raw.id.trim() : channelIdOf(index),
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : driver === 'mote' ? 'mote' : baseUrl,
    driver,
    baseUrl,
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '',
    models,
    enabled: raw.enabled !== false,
  };
}

export function normalizeConfig(raw) {
  const c = raw !== null && typeof raw === 'object' ? raw : {};
  const str = (value, fallback) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback);
  const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);

  let channels = Array.isArray(c.channels) ? c.channels.map(normalizeChannel).filter(Boolean) : [];
  if (channels.length === 0) {
    // Backward compatibility: the single-channel fields become one mote channel.
    const legacyKey = typeof c.apiKey === 'string' ? c.apiKey.trim() : '';
    const legacyBase = trimBase(c.baseUrl) || 'https://platform.sgt.site';
    channels = [
      {
        id: 'mote',
        name: 'mote',
        driver: 'mote',
        baseUrl: legacyBase,
        apiKey: legacyKey,
        models: [],
        enabled: true,
      },
    ];
  }
  // Channel ids must be unique: a duplicate would make routing ambiguous.
  const seen = new Set();
  channels = channels.map((channel, index) => {
    let id = channel.id;
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return { ...channel, id };
  });

  return {
    channels,
    imageModel: str(c.imageModel, ''),
    videoModel: str(c.videoModel, ''),
    imageChannelId: str(c.imageChannelId, ''),
    videoChannelId: str(c.videoChannelId, ''),
    outputDir: str(c.outputDir, ''),
    pollIntervalMs: Math.min(30000, Math.max(500, number(c.pollIntervalMs, 3000))),
  };
}
