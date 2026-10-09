import { lazy } from 'react';

export const loaders = {
  overview: () => import('./pages/overview.jsx'), forms: () => import('./pages/forms.jsx'),
  pointer: () => import('./pages/pointer.jsx'), board: () => import('./pages/board.jsx'),
  files: () => import('./pages/files.jsx'), editor: () => import('./pages/editor.jsx'),
  async: () => import('./pages/async.jsx'), navigation: () => import('./pages/navigation.jsx'),
  frames: () => import('./pages/frames.jsx'), scroll: () => import('./pages/scroll.jsx'),
  media: () => import('./pages/media.jsx'), server: () => import('./pages/server.jsx'),
  workflow: () => import('./pages/workflow.jsx'),
};
export const lazyPages = Object.fromEntries(Object.entries(loaders).map(([id, load]) => [id, lazy(load)]));
export const loadedPages = {};
export const preloadPage = async (id) => { loadedPages[id] = (await loaders[id]()).default; };
