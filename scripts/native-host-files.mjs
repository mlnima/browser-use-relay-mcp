import { randomUUID } from 'node:crypto';
import { access, chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { entryPath, launcherPath } from './native-host-layout.mjs';
import { HOST_NAME } from './native-host-platforms.mjs';

export const verifyNativeBuild = async () => {
  await access(entryPath);
  await access(process.execPath);
};

const writeAtomic = async (filePath, content, mode) => {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const backupPath = `${filePath}.${process.pid}.${randomUUID()}.bak`;
  await mkdir(dirname(filePath), { recursive: true });
  let backedUp = false;
  try {
    await writeFile(temporaryPath, content, { flag: 'wx', mode });
    if (process.platform === 'win32') {
      try {
        await rename(filePath, backupPath);
        backedUp = true;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    await rename(temporaryPath, filePath);
    await chmod(filePath, mode);
    if (backedUp) {
      await rm(backupPath, { force: true });
      backedUp = false;
    }
  } catch (error) {
    if (backedUp) {
      await rm(filePath, { force: true }).catch(() => undefined);
      await rename(backupPath, filePath).then(() => { backedUp = false; }, () => undefined);
    }
    throw error;
  } finally {
    await rm(temporaryPath, { force: true });
    if (!backedUp) await rm(backupPath, { force: true });
  }
};

const batchEscape = (value) => value.replace(/\^/g, '^^').replace(/%/g, '%%');
const shellQuote = (value) => `'${value.replace(/'/g, `'"'"'`)}'`;
const launcherContent = () => process.platform === 'win32'
  ? `@echo off\r\nsetlocal DisableDelayedExpansion\r\nchcp 65001 >nul\r\n"${batchEscape(process.execPath)}" "${batchEscape(entryPath)}" %*\r\n`
  : `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(entryPath)} "$@"\n`;

export const writeLauncher = async (browser) => {
  const filePath = launcherPath(browser);
  await writeAtomic(filePath, launcherContent(), 0o700);
  return filePath;
};

export const writeManifest = async (filePath, extensionId, hostPath) => {
  const manifest = {
    name: HOST_NAME,
    description: 'Browser Use Relay native messaging host',
    path: hostPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
  await writeAtomic(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
};

export const removeManifest = (filePath) => rm(filePath, { force: true });
export const removeLauncher = (browser) => rm(launcherPath(browser), { force: true });
