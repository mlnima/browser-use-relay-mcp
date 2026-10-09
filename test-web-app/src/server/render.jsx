import { renderToString } from 'react-dom/server';
import { App } from '../app.jsx';
import { preloadPage } from '../pages.mjs';
import { getRoute, languages } from '../settings.mjs';
import { dictionaries } from '../locales/translations.mjs';

const serialize = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
export const renderApp = async (initial) => {
  const route = getRoute(initial.pathname); await preloadPage(route.id);
  const direction = languages.find((language) => language.id === initial.lang).direction;
  const content = renderToString(<App initial={initial} />);
  return `<!doctype html>
<html lang="${initial.lang}" dir="${direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${dictionaries[initial.lang].appTitle}</title><link rel="stylesheet" href="/assets/client.css"></head>
<body><div id="app">${content}</div><script id="initial-state" type="application/json">${serialize(initial)}</script>
<script type="module" src="/assets/client.js"></script></body></html>`;
};
export const renderFrame = (url, lang) => {
  const t = (key) => dictionaries[lang][key]; const scope = url.searchParams.get('scope') || 'same';
  const content = renderToString(<main className="frame-body"><form data-scope={scope}><label>{t('message')}<input name="frame-value" required /></label>
    <button className="primary">{t('submit')}</button><output aria-live="polite" /></form>
    {url.searchParams.get('nested') === '1' && <><h3>{t('nestedFrame')}</h3><iframe title={t('nestedFrame')} src={`/frame?lang=${lang}&scope=nested`} /></>}</main>);
  return `<!doctype html><html lang="${lang}" dir="${languages.find((language) => language.id === lang).direction}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/client.css"><title>${t('message')}</title></head>
<body>${content}<script type="module" src="/assets/frame.js"></script></body></html>`;
};
