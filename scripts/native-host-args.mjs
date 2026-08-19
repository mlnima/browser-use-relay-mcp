import { BROWSERS } from './native-host-platforms.mjs';

const INSTALL_USAGE = 'Usage: npm run native:install --workspaces=false -- <chrome|edge|chromium|brave|vivaldi> <extension-id>';
const UNINSTALL_USAGE = 'Usage: npm run native:uninstall --workspaces=false -- <chrome|edge|chromium|brave|vivaldi>';
const fail = (message) => {
  throw new Error(message);
};
const requireBrowser = (browser) => Object.hasOwn(BROWSERS, browser)
  || fail(`Unsupported browser: ${browser || '<missing>'}`);

export const parseInstallArgs = (args) => {
  const [browser, extensionId] = args;
  args.length === 2 || fail(INSTALL_USAGE);
  requireBrowser(browser);
  /^[a-p]{32}$/.test(extensionId) || fail('Extension ID must be exactly 32 lowercase characters from a through p.');
  return { browser, extensionId };
};

export const parseUninstallArgs = (args) => {
  const [browser] = args;
  args.length === 1 || fail(UNINSTALL_USAGE);
  requireBrowser(browser);
  return { browser };
};
