import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Immutable package-owned skill, registered through DSH's normal discovery. */
export function registerImageSkill(ctx, packageRoot) {
  const directory = join(packageRoot, 'skills', 'mote-image');
  const path = join(directory, 'SKILL.md');
  const source = readFileSync(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  const name = match?.[1].match(/^name: (.+)$/m)?.[1].trim();
  const description = match?.[1].match(/^description: (.+)$/m)?.[1].trim();
  if (name !== 'mote-image' || !description || !match[2].trim()) throw new Error('Invalid packaged mote-image skill');
  const definition = { name, description, content: match[2], path, source: 'bundled',
    resourceBase: { kind: 'directory', path: directory }, invocation: { modelInvocable: true, userInvocable: true } };
  const install = (scope) => scope.effect(() => scope.get('skills').register(definition), 'mote-media: image skill');
  if (ctx.get('skills')) install(ctx);
  else ctx.inject(['skills'], install);
}
