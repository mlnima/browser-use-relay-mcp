import { useEffect, useRef, useState } from 'react';
import { useLab } from '../context.jsx';
import { Result, Task, useChecks } from '../components/scenario.jsx';
import { VirtualList } from '../components/virtual-list.jsx';
import { Interruption } from '../components/interruption.jsx';
import { uploadFiles } from '../components/file-transfer.mjs';

const Workflow = () => {
  const { t } = useLab(); const { check, checks } = useChecks(['record', 'consent', 'contact', 'file', 'approval', 'receipt']);
  const [stage, setStage] = useState(1); const [selected, setSelected] = useState(''); const [pending, setPending] = useState(true);
  const [overlay, setOverlay] = useState(false); const [error, setError] = useState(''); const [count, setCount] = useState(0);
  const token = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/records', { signal: controller.signal, cache: 'no-store' }).then((response) => response.json()).then((data) => { setCount(data.total); setPending(false); })
      .catch((failure) => !controller.signal.aborted && setError(failure.message));
    return () => controller.abort();
  }, []);
  const choose = (id) => { setSelected(id); if (id === '042') { check('record', id); setOverlay(true); } };
  const advance = (event) => { event.preventDefault(); check('contact', Object.fromEntries(new FormData(event.currentTarget))); setStage(3); };
  const approve = () => { if (token.current) { check('approval', true); token.current = false; } };
  return <><Task>{t('workflowTask')}</Task><div className="workflow-banner"><span>{t('step')} {stage} / 3</span><span>{t('record')} 042</span></div>
    {stage === 1 && <div className="panel"><h2>{t('select')} 042</h2>{pending ? <p role="status">{t('loading')}</p> : <VirtualList count={count} selected={selected} onSelect={choose} />}
      <button disabled>{t('next')}</button><button hidden>{t('next')}</button><button className="primary" disabled={selected !== '042' || !checks.consent} onClick={() => setStage(2)}>{t('next')}</button></div>}
    {overlay && <Interruption onClose={() => { setOverlay(false); check('consent', true); }} />}
    {stage === 2 && <form className="panel" onSubmit={advance}><h2>{t('contact')}</h2><label>{t('name')} *<input name="name" required /></label>
      <label>{t('email')} *<input name="email" type="email" required /></label><label>{t('chooseFiles')} *<input type="file" required onChange={async (event) => {
        setPending(true); try { check('file', await uploadFiles([...event.target.files])); } catch (failure) { setError(failure.message); } finally { setPending(false); }
      }} /></label><button className="primary" disabled={pending || !checks.file}>{t('next')}</button></form>}
    {stage === 3 && <div className="panel"><h2>{t('approval')}</h2><div className="approval-zone"><div className="approval-token" draggable tabIndex={0}
      onPointerDown={() => { token.current = true; }} onDragStart={(event) => { token.current = true; event.dataTransfer.setData('text/plain', 'approval'); }}>{t('approval')}</div>
      <div className={`approval-drop ${checks.approval ? 'approved' : ''}`} onPointerUp={approve} onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); approve(); }}>{checks.approval ? t('success') : t('dropApproval')}</div></div>
      <button className="primary" disabled={!checks.approval} onClick={() => check('receipt', { record: selected, contact: checks.contact, files: checks.file, approved: true })}>{t('confirm')}</button>
      {checks.receipt && <div className="receipt"><h2>{t('receipt')}</h2><Result value={checks.receipt} /><button onClick={() => window.print()}>{t('print')}</button></div>}</div>}
    {error && <p role="alert">{t('failed')}: {error}</p>}<Result value={Object.keys(checks).length ? checks : undefined} /></>;
};
export default Workflow;
