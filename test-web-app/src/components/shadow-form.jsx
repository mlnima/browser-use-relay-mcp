import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLab } from '../context.jsx';

export const ShadowForm = ({ mode, onSubmit }) => {
  const { t } = useLab(); const host = useRef(null); const [root, setRoot] = useState(null);
  useEffect(() => { setRoot(host.current.attachShadow({ mode })); }, []);
  return <div className="panel"><h2>{t(mode === 'open' ? 'openShadow' : 'closedShadow')}</h2><div ref={host} />{root && createPortal(<>
    <style>{`:host{display:block}form{display:grid;gap:12px}label{display:grid;gap:8px}input{padding:12px;border:1px solid #aaa;background:white;color:#161616;font:inherit;border-radius:4px}button{padding:12px;background:#f2663b;color:white;border:0;border-radius:4px;font:inherit;cursor:pointer}`}</style>
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget).get('shadow-value')); }}>
      <label>{t('message')}<input name="shadow-value" required /></label><button>{t('submit')}</button></form></>, root)}</div>;
};
