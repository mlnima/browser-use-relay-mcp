import { useState } from 'react';
import { useLab } from '../context.jsx';
import { Result } from './scenario.jsx';

export const BrowserDialogs = () => {
  const { t } = useLab(); const [result, setResult] = useState();
  return <div className="panel"><h2>{t('browserDialogs')}</h2><div className="button-row">
    <button onClick={() => { window.alert(t('message')); setResult({ alert: 'closed' }); }}>{t('alertDialog')}</button>
    <button onClick={() => setResult({ confirm: window.confirm(t('confirm')) })}>{t('confirmDialog')}</button>
    <button onClick={() => setResult({ prompt: window.prompt(t('message')) })}>{t('promptDialog')}</button>
    <button onClick={async () => {
      try { setResult({ permission: await Notification.requestPermission() }); } catch (error) { setResult({ error: error.message }); }
    }}>{t('notification')}</button>
  </div><Result label={t('permission')} value={result} /></div>;
};
