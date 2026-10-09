import { useEffect, useState } from 'react';
import { useLab } from '../context.jsx';
import { Task, Result, useChecks } from '../components/scenario.jsx';

const Async = () => {
  const { t } = useLab(); const { check, checks } = useChecks(['search', 'retry', 'more', 'selected']);
  const [query, setQuery] = useState(''); const [page, setPage] = useState(0); const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0); const [items, setItems] = useState([]); const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('loading'); const [hadFailure, setHadFailure] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/records?q=${encodeURIComponent(query)}&page=${page}&fail=${failure ? 1 : 0}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error();
        const result = await response.json(); setItems((previous) => page ? [...previous, ...result.items] : result.items);
        setTotal(result.total); setStatus('success');
        if (query === '042') check('search', query);
        if (hadFailure) check('retry', true);
        if (page && result.items.length) check('more', true);
      } catch (error) { if (!controller.signal.aborted) { setStatus('failed'); setHadFailure(true); } }
    }, 280);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, page, failure, attempt]);
  return <><Task>{t('asyncTask')} {t('clear')} {t('search')} → {t('loadMore')}.</Task><div className="store-bar"><label>{t('search')}
    <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><button onClick={() => { setFailure(true); setAttempt((value) => value + 1); }}>{t('simulateFailure')}</button></div>
    <div aria-live="polite" className="request-status">{status === 'loading' ? <><span className="spinner" />{t('loading')}</> : status === 'failed' ? <>
      <span role="alert">{t('failed')}</span><button onClick={() => { setFailure(false); setAttempt((value) => value + 1); }}>{t('retry')}</button></> : `${items.length} / ${total}`}</div>
    <div className="product-grid">{items.map((item) => <article className="product-card" key={item.id}><div className={`product-art art-${Number(item.id) % 4}`} aria-hidden="true"><span>{item.id}</span></div>
      <span className="eyebrow">{t('fixtureNotice')}</span><h3>{t('item')} {item.id}</h3><p>{t('quantity')}: {item.quantity}</p><button className="primary" onClick={() => item.id === '042' && check('selected', item)}>{t('select')} {item.id}</button></article>)}</div>
    {status === 'success' && !items.length && <p>{t('noResults')}</p>}<button disabled={status !== 'success' || items.length >= total} onClick={() => setPage((value) => value + 1)}>{t('loadMore')}</button>
    <Result value={Object.keys(checks).length ? checks : undefined} /></>;
};
export default Async;
