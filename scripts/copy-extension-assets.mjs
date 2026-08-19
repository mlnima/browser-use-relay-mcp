import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const extensionRoot = join(packageRoot, 'extension');
const publicRoot = join(extensionRoot, 'public');
const outputRoot = join(extensionRoot, 'dist');
const outputRelativePath = relative(packageRoot, outputRoot);
const htmlFiles = ['popup.html', 'options.html', 'offscreen.html'];
const iconSizes = [16, 32, 48, 128];

if (!outputRelativePath || outputRelativePath.startsWith('..')) throw new Error('Invalid extension output path');

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(publicRoot, outputRoot, { recursive: true });
await Promise.all(htmlFiles.map((name) => cp(join(extensionRoot, name), join(outputRoot, name))));
await Promise.all(iconSizes.map((size) => sharp(join(publicRoot, 'icons/icon.svg'), { density: 512 })
  .resize(size, size)
  .png()
  .toFile(join(outputRoot, `icons/icon-${size}.png`))));
