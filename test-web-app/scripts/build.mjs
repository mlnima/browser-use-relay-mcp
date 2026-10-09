import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const outputRoot = resolve(appRoot, '../dist/test-web-app');
export const buildApp = async (development = false) => {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  const common = {
    absWorkingDir: appRoot, bundle: true, jsx: 'automatic', minify: true,
    sourcemap: 'external', logLevel: 'info',
    define: { 'process.env.NODE_ENV': JSON.stringify(development ? 'development' : 'production') },
  };
  await build({ ...common, entryPoints: { client: 'src/client.jsx', frame: 'src/frame-client.mjs' },
    outdir: resolve(outputRoot, 'assets'), splitting: true, format: 'esm', platform: 'browser', target: 'es2022' });
  await build({ ...common, entryPoints: ['src/server/server.jsx'], outfile: resolve(outputRoot, 'server.mjs'),
    platform: 'node', format: 'esm', target: 'node20', banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" } });
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildApp();
