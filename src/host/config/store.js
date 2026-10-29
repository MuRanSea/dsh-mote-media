import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { normalizeConfig, normalizeChannel } from './normalize.js';

const PKG = '@local/dsh-mote-media';

/** The package root supplies the overlay path; moving this module never moves credentials. */
export function createConfigStore(overlayPath, environment = process.env) {
  const OVERLAY_PATH = overlayPath;
  const result = (data, status = 200) => ({ data, status });

  function readOverlay() {
    try {
      const parsed = JSON.parse(readFileSync(OVERLAY_PATH, 'utf8'));
      return parsed !== null && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeOverlay(patch) {
    const next = { ...readOverlay(), ...patch };
    writeFileSync(OVERLAY_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
  }

  function resolveConfig(raw) {
    const overlay = readOverlay();
    const normalized = normalizeConfig({ ...normalizeConfig(raw), ...overlay });
    if (normalized.channels.every((channel) => channel.apiKey === '')) {
      const fromEnv = typeof environment.MOTE_API_KEY === 'string' ? environment.MOTE_API_KEY.trim() : '';
      if (fromEnv !== '') {
        normalized.channels = normalized.channels.map((channel, index) =>
          index === 0 ? { ...channel, apiKey: fromEnv } : channel,
        );
      }
    }
    return normalized;
  }

  async function saveConfig(ctx, mote, patch) {
    if (patch === null || typeof patch !== 'object') return result({ ok: false, error: { message: 'patch is required' } }, 400);
    const next = {};
    for (const key of ['baseUrl', 'apiKey', 'imageModel', 'videoModel', 'imageChannelId', 'videoChannelId', 'outputDir']) {
      if (typeof patch[key] === 'string') next[key] = patch[key].trim();
    }
    if (Array.isArray(patch.channels)) {
      // The panel never receives stored keys, so a blank key means "keep the old one".
      const current = mote.channels({ includeSecrets: true });
      const channels = patch.channels
        .map(normalizeChannel)
        .filter(Boolean)
        .map((channel) => {
          if (channel.apiKey !== '') return channel;
          const existing = current.find((item) => item.id === channel.id);
          return existing && typeof existing.apiKey === 'string' && existing.apiKey !== ''
            ? { ...channel, apiKey: existing.apiKey }
            : channel;
        });
      if (channels.length > 0) next.channels = channels;
    }
    if (Number.isFinite(patch.pollIntervalMs)) next.pollIntervalMs = patch.pollIntervalMs;
    if (Object.keys(next).length === 0) return result({ ok: false, error: { message: 'nothing to save' } }, 400);
    mote.configure(next);
    let mirrored = false;
    const editor = ctx.get('configEditor');
    if (editor) {
      const entry = findEntry(editor);
      if (entry) {
        try {
          await editor.edit(entry, (current) => ({ ...(current || {}), ...next }));
          mirrored = true;
        } catch {
          /* fall through to the overlay */
        }
      }
    }
    if (mirrored) {
      // The loader row now owns the values; drop a stale overlay so the file and
      // the profile cannot disagree.
      try {
        rmSync(OVERLAY_PATH, { force: true });
      } catch {
        /* nothing to remove */
      }
    } else {
      try {
        writeOverlay(next);
      } catch (error) {
        return result({
          ok: false,
          error: {
            message: `cannot write ${OVERLAY_PATH}: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    }
    return result({ ok: true, mirrored, ...mote.status(), canEditConfig: true });
  }

  function findEntry(editor) {
    let entries;
    try {
      entries = editor.entries();
    } catch {
      return undefined;
    }
    if (!Array.isArray(entries)) return undefined;
    return entries.find((entry) => {
      const name = entry?.name ?? entry?.options?.name ?? entry?.data?.name;
      return name === PKG;
    });
  }

  return { overlayPath, resolveConfig, saveConfig };
}
