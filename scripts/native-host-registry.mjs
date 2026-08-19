import { spawnSync } from 'node:child_process';
import { BROWSERS, HOST_NAME } from './native-host-platforms.mjs';

const registryKey = (browser) => `${BROWSERS[browser].registry}\\${HOST_NAME}`;
const runRegistry = (args) => {
  const result = spawnSync('reg.exe', args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `reg.exe exited with status ${result.status}`);
  }
};

export const registerWindowsHost = (browser, filePath) => runRegistry([
  'add',
  registryKey(browser),
  '/ve',
  '/t',
  'REG_SZ',
  '/d',
  filePath,
  '/f',
]);

export const unregisterWindowsHost = (browser) => {
  const key = registryKey(browser);
  const query = spawnSync('reg.exe', ['query', key], { encoding: 'utf8', windowsHide: true });
  if (query.error) throw query.error;
  if (query.status === 1) return;
  if (query.status !== 0) throw new Error(query.stderr?.trim() || `reg.exe exited with status ${query.status}`);
  runRegistry(['delete', key, '/f']);
};
