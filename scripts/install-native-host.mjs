import { parseInstallArgs } from './native-host-args.mjs';
import { verifyNativeBuild, writeLauncher, writeManifest } from './native-host-files.mjs';
import { assertSupportedPlatform, manifestPath } from './native-host-layout.mjs';
import { registerWindowsHost } from './native-host-registry.mjs';

const install = async () => {
  const { browser, extensionId } = parseInstallArgs(process.argv.slice(2));
  assertSupportedPlatform();
  await verifyNativeBuild();
  const filePath = manifestPath(browser);
  const hostPath = await writeLauncher(browser);
  await writeManifest(filePath, extensionId, hostPath);
  if (process.platform === 'win32') registerWindowsHost(browser, filePath);
  process.stdout.write(`Native messaging host installed for ${browser}.\n`);
};

await install().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
