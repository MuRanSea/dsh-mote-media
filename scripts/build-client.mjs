import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../client.js', import.meta.url);

export async function renderClient() {
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['src/client/entry.js'],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    charset: 'utf8',
    write: false,
    metafile: true,
    logLevel: 'silent',
    banner: { js: '// Generated from src/client/entry.js. Do not edit; run npm run build.' },
    plugins: [{
      name: 'host-provided-react',
      setup(builder) {
        builder.onResolve({ filter: /^react(?:-dom)?(?:\/|$)/ }, () => ({
          errors: [{ text: 'Use the React instance passed by the DSH module loader; do not import a second React runtime.' }],
        }));
      },
    }],
  });
  if (result.outputFiles.length !== 1 || Object.values(result.metafile.outputs).some((entry) => entry.imports.length > 0)) {
    throw new Error('The DSH client must be a single self-contained script.');
  }
  return result.outputFiles[0].text;
}

export async function checkClient() {
  const expected = await renderClient();
  const current = await readFile(output, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  if (current.replace(/\r\n/g, '\n') !== expected) {
    throw new Error('client.js is missing or out of date. Run npm run build and include client.js with the source changes.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--check')) {
      await checkClient();
      console.log('client.js matches its source.');
    } else {
      await writeFile(output, await renderClient());
      console.log('Built client.js from src/client/entry.js.');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
