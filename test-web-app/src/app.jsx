import { Suspense, useCallback, useEffect, useState } from 'react';
import { LabContext } from './context.jsx';
import { dictionaries } from './locales/translations.mjs';
import { languages, routes, getRoute } from './settings.mjs';
import { lazyPages, loadedPages } from './pages.mjs';
import { EventLog } from './components/event-log.jsx';
import { Icon } from './components/icons.jsx';

export const App = ({ initial }) => {
  const [route, setRoute] = useState(getRoute(initial.pathname));
  const [lang, setLang] = useState(initial.lang);
  const [results, setResults] = useState({});
  const [run, setRun] = useState(0);
  const t = (key) => dictionaries[lang][key];
  const language = languages.find((item) => item.id === lang);
  const complete = useCallback((id, value) => setResults((previous) => ({ ...previous, [id]: value })), []);
  const navigate = (id, selectedLanguage = lang) => {
    history.pushState({}, '', `/${id}?lang=${selectedLanguage}`);
    setRoute(getRoute(`/${id}`)); setLang(selectedLanguage); window.scrollTo(0, 0);
  };
  useEffect(() => {
    document.documentElement.lang = lang; document.documentElement.dir = language.direction;
    document.title = `${t(route.id)} · ${t('appTitle')}`;
  }, [lang, route.id]);
  useEffect(() => {
    const change = () => { setRoute(getRoute(location.pathname)); setLang(new URLSearchParams(location.search).get('lang') || initial.lang); };
    window.addEventListener('popstate', change);
    return () => window.removeEventListener('popstate', change);
  }, []);
  const Page = loadedPages[route.id] || lazyPages[route.id];
  const finished = Object.keys(results).length;
  const link = (event, id) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(id);
  };
  return <LabContext value={{ t, lang, route, results, complete, navigate, initial }}>
    <div className="lab-shell" dir={language.direction}>
      <aside className="rail"><a className="brand" href={`/overview?lang=${lang}`} onClick={(event) => link(event, 'overview')}>
        <span className="brand-mark"><Icon name="activity" size={26} /></span><span>RELAY<span>{t('lab')}</span></span></a>
        <div className="rail-caption">{t('scenarioLibrary')}</div>
        <nav aria-label={t('scenarioLibrary')}>{routes.map((item, index) => <a key={item.id} aria-current={route.id === item.id ? 'page' : undefined}
          href={`/${item.id}?lang=${lang}`} onClick={(event) => link(event, item.id)}>
          <span className="nav-index">{String(index).padStart(2, '0')}</span><span>{t(item.id)}</span>
          {results[item.id] && <Icon name="check" size={15} />}</a>)}</nav>
        <div className="rail-foot"><span className="connection-dot" />{t('fixtureNotice')}<small>{t('localOnly')}</small></div>
      </aside>
      <div className="workspace"><header className="topbar"><span className="breadcrumb">{t('lab')} <span>/</span> {t(route.id)}</span>
        <div className="toolbar"><Icon name="globe" size={18} /><select aria-label={t('language')} value={lang} onChange={(event) => navigate(route.id, event.target.value)}>
          <option value="" disabled>{t('language')}</option>{languages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <button className="reset-button" onClick={() => { setResults({}); setRun((value) => value + 1); }}><Icon name="reset" size={16} /><span>{t('resetRun')}</span></button></div></header>
        <main><div className="page-heading"><div><div className="eyebrow">{route.level ? `${t('level')} ${route.level} / 5` : t('testEnvironment')}</div>
          <h1>{t(route.id)}</h1><p>{t(`${route.id}Description`)}</p></div>
          <div className="heading-meta"><span className={`difficulty difficulty-${route.level}`}>{t(`difficulty${route.level}`)}</span><span className="mode-tag">{t(route.mode)}</span></div></div>
          <section className={`test-surface style-${route.style}`} data-test-surface="" key={`${route.id}-${run}`}>
            <Suspense fallback={<div className="loading-panel" role="status"><span className="spinner" />{t('loading')}</div>}><Page /></Suspense>
          </section>
          {route.level > 0 && <EventLog />}
        </main>
        <footer><span>{t('progress')} <strong><bdi dir="ltr">{finished} / {routes.length - 1}</bdi></strong></span><div className="progress-track"><span style={{ width: `${finished / (routes.length - 1) * 100}%` }} /></div>
          <span>{t('observeActVerify')}</span></footer>
      </div>
    </div>
  </LabContext>;
};
