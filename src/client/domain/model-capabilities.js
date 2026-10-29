/** Model catalog rules shared by the composer and task submission. */
export function modelChoices(models, type) {
  return Array.isArray(models[type]) ? models[type] : [];
}

export function modelValue(model) {
  return JSON.stringify([model.channelId || '', model.id]);
}

export function modelById(models, type, id, channelId) {
  const choices = modelChoices(models, type);
  const exact = choices.find((entry) => modelValue(entry) === id);
  if (exact) return exact;
  const matches = choices.filter((entry) => entry.id === id && (!channelId || entry.channelId === channelId));
  return matches.length === 1 ? matches[0] : null;
}

function paramEntries(model) {
  const parameters = model && model.parameters && typeof model.parameters === 'object' ? model.parameters : {};
  return Object.entries(parameters).filter(([key]) => key !== 'prompt');
}

export function defaultParams(model) {
  const out = {};
  for (const [key, spec] of paramEntries(model)) {
    if (spec && spec.default !== undefined && spec.default !== null) out[key] = spec.default;
  }
  return out;
}

/** Ratio to pixel size for models that accept `size` but no `aspect_ratio` (GPT Image). */
export const SIZE_BY_RATIO = {
  '1:1': '1024x1024',
  '4:3': '1152x864',
  '3:4': '864x1152',
  '16:9': '1536x864',
  '9:16': '864x1536',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
  '21:9': '1792x768',
};

export function ratioToSize(ratio) {
  return SIZE_BY_RATIO[ratio] || '';
}

export function sizeToRatio(size) {
  if (typeof size !== 'string' || size === '' || size === 'auto') return '';
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim());
  if (!match) return '';
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return '';
  const target = width / height;
  let best = '';
  let distance = Infinity;
  for (const [ratio, pixels] of Object.entries(SIZE_BY_RATIO)) {
    const [w, h] = pixels.split('x').map(Number);
    const gap = Math.abs(w / h - target);
    if (gap < distance) {
      distance = gap;
      best = ratio;
    }
  }
  return best;
}

/**
 * Keep only the parameters this model actually declares. A stale field from a
 * previous model (for example `aspect_ratio` on GPT Image) is dropped instead
 * of being rejected upstream with `unsupported_parameter`.
 */
export function paramsForModel(model, params) {
  const specs = model && model.parameters && typeof model.parameters === 'object' ? model.parameters : {};
  // Drop undeclared keys first: a leftover `size` from another model must not
  // take a valid `aspect_ratio` down with it in the conflict pass below.
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === '' || value === undefined || value === null) continue;
    if (!specs[key]) continue;
    out[key] = value;
  }
  if (out.size !== undefined) {
    if (out.aspect_ratio !== undefined) delete out.aspect_ratio;
    if (out.size === out.resolution) delete out.resolution;
  }
  return out;
}

export function cleanParams(params) {
  const out = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value === '' || value === undefined || value === null) continue;
    out[key] = value;
  }
  if (out.size !== undefined) {
    if (out.aspect_ratio !== undefined) delete out.aspect_ratio;
    if (out.size === out.resolution) delete out.resolution;
  }
  return out;
}

export function referenceRoles(model) {
  const specs = model && Array.isArray(model.references) ? model.references : [];
  const limitFor = (role, kind = 'image') => {
    const spec = specs.find((entry) => entry && entry.role === role && Array.isArray(entry.types) && entry.types.includes(kind));
    return spec ? Number(spec.max_count ?? 1) : 0;
  };
  return {
    reference: limitFor('reference', 'image') > 0,
    referenceLimit: limitFor('reference', 'image'),
    firstFrame: limitFor('first_frame', 'image') > 0,
    lastFrame: limitFor('last_frame', 'image') > 0,
  };
}
