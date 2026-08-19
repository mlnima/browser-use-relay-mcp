import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionRoot = join(packageRoot, 'extension');
const outputRoot = join(extensionRoot, 'dist');
const entries = [
  ['background', 'src/background/main.ts', 'esm'],
  ['content', 'src/content/main.ts', 'iife'],
  ['popup', 'src/popup/main.tsx', 'esm'],
  ['options', 'src/options/main.tsx', 'esm'],
  ['offscreen', 'src/offscreen/main.ts', 'esm'],
];

const buildEntry = ([name, entryPoint, format]) => build({
  entryPoints: [join(extensionRoot, entryPoint)],
  outfile: join(outputRoot, `${name}.js`),
  bundle: true,
  platform: 'browser',
  format,
  target: ['chrome130', 'edge130'],
  minify: true,
  treeShaking: true,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.svg': 'dataurl' },
});

await Promise.all(entries.map(buildEntry));
