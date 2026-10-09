import { useEffect, useRef } from 'react';
import { useLab } from '../context.jsx';

export const Interruption = ({ onClose }) => {
  const { t } = useLab(); const dialog = useRef(null);
  useEffect(() => { dialog.current.showModal(); }, []);
  const close = () => { dialog.current.close(); onClose(); };
  return <dialog ref={dialog} className="interruption" onCancel={(event) => { event.preventDefault(); close(); }}>
    <span className="eyebrow">{t('interruption')}</span><h2>{t('consent')}</h2><p>{t('fixtureNotice')}</p><button className="primary" onClick={close}>{t('consent')}</button></dialog>;
};
