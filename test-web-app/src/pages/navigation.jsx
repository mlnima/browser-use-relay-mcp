import { useEffect, useState } from 'react';
import { useLab } from '../context.jsx';
import { Result, Task, useChecks } from '../components/scenario.jsx';
import { BrowserDialogs } from '../components/browser-dialogs.jsx';

const Navigation = () => {
  const { t, lang, navigate, initial } = useLab(); const { checks, check } = useChecks(['wizard', 'popup']);
  const query = new URLSearchParams(initial.search); const popup = query.get('popup') === '1';
  const [step, setStep] = useState(Number(query.get('step')) || 1);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    const receive = (event) => event.data?.fixture === 'receipt' && check('popup', event.data);
    const back = () => setStep(Number(new URLSearchParams(location.search).get('step')) || 1);
    window.addEventListener('message', receive); window.addEventListener('popstate', back);
    return () => { window.removeEventListener('message', receive); window.removeEventListener('popstate', back); };
  }, []);
  const advance = (event) => {
    event.preventDefault(); const next = step + 1;
    history.pushState({}, '', `/navigation?lang=${lang}&step=${next}`); setStep(next);
    if (next === 3) check('wizard', { name, email });
  };
  return <><Task>{t('navigationTask')}</Task>{popup ? <div className="panel"><h2>{t('receipt')}</h2><button className="primary" onClick={() => {
    window.opener?.postMessage({ fixture: 'receipt', confirmed: true }, location.origin); window.close();
  }}>{t('confirm')}</button></div> : <div className="two-columns"><div className="panel wizard"><div className="steps">{[1, 2, 3].map((value) => <span key={value} className={value === step ? 'active-step' : ''}>{value}</span>)}</div>
    <h2>{t('step')} {step} / 3</h2>{step < 3 ? <form onSubmit={advance}>
      {step === 1 ? <label>{t('name')} *<input name="wizard-name" required value={name} onChange={(event) => setName(event.target.value)} /></label>
        : <label>{t('email')} *<input name="wizard-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      <button className="primary">{t('next')}</button></form> : <><Result value={{ name, email }} /><button className="primary" onClick={() => {
        const child = window.open(`/navigation?lang=${lang}&popup=1`, 'relay-confirmation', 'width=620,height=520');
        if (!child) setError(t('blocked'));
      }}>{t('openPopup')}</button></>}
    <div className="button-row"><button onClick={() => history.back()}>{t('back')}</button><button onClick={() => history.forward()}>{t('next')}</button></div>
    <a href={`/server?lang=${lang}`} target="_blank" rel="noopener">{t('openTab')}</a>{error && <p role="alert">{error}</p>}</div>
    <div><div className="panel"><h2>{t('navigation')}</h2><button onClick={() => navigate('forms')}>{t('forms')}</button><button onClick={() => navigate('server')}>{t('server')}</button></div><BrowserDialogs /><Result value={Object.keys(checks).length ? checks : undefined} /></div>
  </div>}</>;
};
export default Navigation;
