import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BROWSERS, HOST_NAME, SUPPORTED_PLATFORMS } from './native-host-platforms.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));

export const packageRoot = resolve(scriptDirectory, '..');
export const entryPath = join(packageRoot, 'dist', 'native', 'entry.js');

export const assertSupportedPlatform = () => {
  if (!SUPPORTED_PLATFORMS.includes(process.platform)) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
};

export const launcherPath = (browser) => join(
  homedir(),
  '.browser-use-relay-mcp',
  'native-hosts',
  browser,
  `${HOST_NAME}${process.platform === 'win32' ? '.cmd' : '.sh'}`,
);

export const manifestPath = (browser) => {
  if (process.platform === 'win32') {
    return join(homedir(), '.browser-use-relay-mcp', 'native-hosts', browser, `${HOST_NAME}.json`);
  }

  return join(homedir(), ...BROWSERS[browser][process.platform], `${HOST_NAME}.json`);
};
