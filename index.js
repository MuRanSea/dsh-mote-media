import { fileURLToPath } from 'node:url';
import { createMote } from './src/host/media/service.js';
import { createConfigStore } from './src/host/config/store.js';
import { registerTools } from './src/host/tools/register.js';
import { registerRoute } from './src/host/routes/register.js';
import { createSubmissionStore } from './src/host/media/submissions.js';
import { registerImageSkill } from './src/host/skills/register.js';

export const inject = ['tools'];

export function apply(ctx, config) {
  const store = createConfigStore(fileURLToPath(new URL('./.mote-state.json', import.meta.url)));
  const diag = { registered: false, error: null, connection: false };
  const mote = createMote(store.resolveConfig(config));
  const submissions = createSubmissionStore(fileURLToPath(new URL('./.mote-submissions/', import.meta.url)), mote);
  registerImageSkill(ctx, fileURLToPath(new URL('./', import.meta.url)));
  registerTools(ctx, mote, submissions);
  registerRoute(ctx, mote, diag, store, submissions);
}
