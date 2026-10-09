export const defaults = { port: 5000, language: 'en', host: '0.0.0.0' };
export const languages = [
  { id: 'en', name: 'English', direction: 'ltr' },
  { id: 'de', name: 'Deutsch', direction: 'ltr' },
  { id: 'fr', name: 'Français', direction: 'ltr' },
  { id: 'es', name: 'Español', direction: 'ltr' },
  { id: 'zh', name: '中文', direction: 'ltr' },
  { id: 'ja', name: '日本語', direction: 'ltr' },
  { id: 'fa', name: 'فارسی', direction: 'rtl' },
  { id: 'ar', name: 'العربية', direction: 'rtl' },
  { id: 'hi', name: 'हिन्दी (Indian)', direction: 'ltr' },
  { id: 'ru', name: 'Русский', direction: 'ltr' },
];
export const routes = [
  { id: 'overview', level: 0, mode: 'serverMode', style: 'overview' },
  { id: 'forms', level: 1, mode: 'serverMode', style: 'paper' },
  { id: 'pointer', level: 2, mode: 'lazyMode', style: 'dark' },
  { id: 'board', level: 3, mode: 'lazyMode', style: 'pastel' },
  { id: 'files', level: 2, mode: 'lazyMode', style: 'terminal' },
  { id: 'editor', level: 3, mode: 'lazyMode', style: 'paper' },
  { id: 'async', level: 4, mode: 'fetchMode', style: 'shop' },
  { id: 'navigation', level: 2, mode: 'lazyMode', style: 'paper' },
  { id: 'frames', level: 4, mode: 'lazyMode', style: 'dark' },
  { id: 'scroll', level: 4, mode: 'lazyMode', style: 'terminal' },
  { id: 'media', level: 3, mode: 'lazyMode', style: 'pastel' },
  { id: 'server', level: 2, mode: 'serverMode', style: 'paper' },
  { id: 'workflow', level: 5, mode: 'fetchMode', style: 'shop' },
];
export const getRoute = (pathname) => routes.find((route) => `/${route.id}` === pathname) || routes[0];
