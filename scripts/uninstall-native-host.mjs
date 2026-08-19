import { parseUninstallArgs } from './native-host-args.mjs';
import { removeLauncher, removeManifest } from './native-host-files.mjs';
import { assertSupportedPlatform, manifestPath } from './native-host-layout.mjs';
import { unregisterWindowsHost } from './native-host-registry.mjs';

const uninstall = async () => {
  const { browser } = parseUninstallArgs(process.argv.slice(2));
  assertSupportedPlatform();
  const filePath = manifestPath(browser);
  if (process.platform === 'win32') unregisterWindowsHost(browser);
  await removeManifest(filePath);
  await removeLauncher(browser);
  process.stdout.write(`Native messaging host uninstalled for ${browser}.\n`);
};

await uninstall().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
