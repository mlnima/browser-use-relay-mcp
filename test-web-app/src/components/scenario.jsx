import { useRef, useState } from 'react';
import { useLab } from '../context.jsx';

export const useChecks = (required) => {
  const { route, complete } = useLab();
  const [checks, setChecks] = useState({});
  const current = useRef({});
  const check = (id, value) => {
    const next = { ...current.current, [id]: value };
    current.current = next; setChecks(next);
    if (required.every((key) => next[key] !== undefined && next[key] !== false)) complete(route.id, next);
  };
  return { checks, check };
};
export const Result = ({ value, label }) => {
  const { t } = useLab();
  return <div className={`result ${value === undefined ? '' : 'has-result'}`} aria-live="polite">
    <span className="eyebrow">{label || t('actualResult')}</span>
    {value === undefined ? <p>{t('waiting')}</p> : <pre>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>}
  </div>;
};
export const Task = ({ children }) => {
  const { t } = useLab();
  return <div className="task-note"><span className="eyebrow">{t('task')}</span><p>{children}</p></div>;
};
