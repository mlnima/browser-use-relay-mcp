import { useState } from 'react';
import { useLab } from '../context.jsx';
import { languages, routes } from '../settings.mjs';
import { Icon } from '../components/icons.jsx';

const Overview = () => {
  const { t, navigate, results, lang } = useLab();
  const [level, setLevel] = useState('');
  const scenarios = routes.filter((route) => route.level && (!level || route.level === Number(level)));
  return <><div className="overview-hero"><div className="hero-copy"><span className="eyebrow">RELAY / {t('testEnvironment')}</span>
    <h2>{t('overviewHeadline')}</h2><p>{t('overviewIntro')}</p><button className="primary" onClick={() => navigate('forms')}>{t('startScenario')}<Icon name="arrow" /></button></div>
    <div className="hero-diagram" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="diagram-core"><Icon name="activity" size={56} /></div>
      <span className="diagram-label label-one">INPUT</span><span className="diagram-label label-two">STATE</span><span className="diagram-label label-three">RESULT</span></div></div>
    <div className="metrics"><div><strong>{routes.length - 1}</strong><span>{t('scenarioCount')}</span></div><div><strong>{languages.length}</strong><span>{t('languageCount')}</span></div>
      <div><strong>3</strong><span>{t('inputEngines')}</span></div><div><strong>{Object.keys(results).length}</strong><span>{t('success')}</span></div></div>
    <div className="library-heading"><h2>{t('scenarioLibrary')}</h2><select aria-label={t('filter')} value={level} onChange={(event) => setLevel(event.target.value)}>
      <option value="">{t('all')}</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{t(`difficulty${value}`)}</option>)}</select></div>
    <div className="scenario-grid">{scenarios.map((route) => <a className={`scenario-card difficulty-card-${route.level}`} key={route.id} href={`/${route.id}?lang=${lang}`}
      onClick={(event) => { if (event.ctrlKey || event.metaKey || event.shiftKey) return; event.preventDefault(); navigate(route.id); }}>
      <div className="card-top"><span className={`difficulty difficulty-${route.level}`}>{t(`difficulty${route.level}`)}</span><Icon name={route.id === 'files' ? 'file' : route.id === 'frames' ? 'code' : 'grid'} /></div>
      <h3>{t(route.id)}</h3><p>{t(`${route.id}Description`)}</p><div className="card-bottom"><span>{results[route.id] ? t('success') : t('notStarted')}</span><Icon name="arrow" size={18} /></div></a>)}</div>
  </>;
};
export default Overview;
