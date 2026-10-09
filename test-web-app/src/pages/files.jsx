import { useState } from 'react';
import { useLab } from '../context.jsx';
import { Task, Result, useChecks } from '../components/scenario.jsx';
import { downloadFile, uploadFiles } from '../components/file-transfer.mjs';

const Files = () => {
  const { t } = useLab(); const { check, checks } = useChecks(['upload', 'drop', 'download']);
  const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const upload = async (selected, dropped = false) => {
    setBusy(true); setError('');
    try { const result = await uploadFiles(selected); check(dropped ? 'drop' : 'upload', result); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <><Task>{t('filesTask')}</Task><div className="two-columns"><div className="panel"><h2>{t('upload')}</h2>
    <label>{t('chooseFiles')}<input type="file" multiple onChange={(event) => setFiles([...event.target.files])} /></label>
    <label>{t('chooseDirectory')}<input type="file" multiple webkitdirectory="" onChange={(event) => setFiles([...event.target.files])} /></label>
    <ul className="file-list">{files.map((file, index) => <li key={index}><span>{file.webkitRelativePath || file.name}</span><code>{file.size} {t('bytes')}</code></li>)}</ul>
    <button className="primary" disabled={!files.length || busy} onClick={() => upload(files)}>{busy ? t('loading') : t('upload')}</button>
    <div className={`dropzone ${over ? 'drag-over' : ''}`} onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(event) => { event.preventDefault(); setOver(false); const incoming = [...event.dataTransfer.files]; setFiles(incoming); if (incoming.length) void upload(incoming, true); }}>
      <span className="drop-icon">↓</span><strong>{t('dropFiles')}</strong></div>
  </div><div><div className="panel"><h2>{t('download')}</h2><button onClick={async () => {
    try { check('download', await downloadFile('/api/download', 'relay-fixture.txt')); } catch (failure) { setError(failure.message); }
  }}>{t('download')} / TXT</button>
    {checks.upload?.map((file) => <button key={file.id} onClick={() => downloadFile(`/api/download?id=${file.id}`, file.name).catch((failure) => setError(failure.message))}>{t('download')} / {file.name}</button>)}</div>
    <Result value={Object.keys(checks).length ? checks : undefined} />{error && <p role="alert">{t('failed')}: {error}</p>}</div></div></>;
};
export default Files;
