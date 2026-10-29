/** Compatibility facade for the original Host imports. */
export { createMote } from './src/host/media/service.js';
export { DEFAULT_OUTPUT_DIR } from './src/host/channels/registry.js';
export { DRIVERS, normalizeChannel, normalizeConfig } from './src/host/config/normalize.js';
export { PENDING_STATUSES } from './src/host/media/tasks.js';
export { ASSET_PATH, extensionFor, sniffMime } from './src/host/media/artifacts.js';
export { toReferences, isNonPublicHost, isNonPublicUrl } from './src/host/media/references.js';
