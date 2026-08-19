export const HOST_NAME = 'net.eskai.browser_use_relay';

export const BROWSERS = {
  chrome: {
    registry: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts',
    darwin: ['Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'],
    linux: ['.config', 'google-chrome', 'NativeMessagingHosts'],
  },
  edge: {
    registry: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts',
    darwin: ['Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts'],
    linux: ['.config', 'microsoft-edge', 'NativeMessagingHosts'],
  },
  chromium: {
    registry: 'HKCU\\Software\\Chromium\\NativeMessagingHosts',
    darwin: ['Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'],
    linux: ['.config', 'chromium', 'NativeMessagingHosts'],
  },
  brave: {
    registry: 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts',
    darwin: ['Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'],
    linux: ['.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'],
  },
  vivaldi: {
    registry: 'HKCU\\Software\\Vivaldi\\NativeMessagingHosts',
    darwin: ['Library', 'Application Support', 'Vivaldi', 'NativeMessagingHosts'],
    linux: ['.config', 'vivaldi', 'NativeMessagingHosts'],
  },
};

export const SUPPORTED_PLATFORMS = ['win32', 'darwin', 'linux'];
