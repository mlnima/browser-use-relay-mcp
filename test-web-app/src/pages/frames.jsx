import { useEffect } from 'react';
import { useLab } from '../context.jsx';
import { Task, Result, useChecks } from '../components/scenario.jsx';
import { ShadowForm } from '../components/shadow-form.jsx';

const Frames = () => {
  const { t, lang, initial } = useLab(); const { checks, check } = useChecks(['same', 'nested', 'cross', 'open', 'closed']);
  useEffect(() => {
    const receive = (event) => { if (event.data?.fixture === 'frame') check(event.data.scope, event.data.value); };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, []);
  return <><Task>{t('framesTask')}</Task><div className="two-columns"><section className="panel"><h2>{t('sameOrigin')}</h2>
    <iframe title={t('sameOrigin')} src={`/frame?lang=${lang}&scope=same&nested=1`} className="fixture-frame nested-frame" /></section>
    <section className="panel"><h2>{t('crossOrigin')}</h2><iframe title={t('crossOrigin')} src={`${initial.frameOrigin}/frame?lang=${lang}&scope=cross`} className="fixture-frame" /></section>
    <ShadowForm mode="open" onSubmit={(value) => check('open', value)} /><ShadowForm mode="closed" onSubmit={(value) => check('closed', value)} /></div>
    <Result value={Object.keys(checks).length ? checks : undefined} /></>;
};
export default Frames;
