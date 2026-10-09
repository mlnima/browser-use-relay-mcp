import { useState } from 'react';
import { useLab } from '../context.jsx';
import { Task, Result, useChecks } from '../components/scenario.jsx';

const Server = () => {
  const { t, initial } = useLab(); const { check, checks } = useChecks(['sorted', 'selected']); const [sorted, setSorted] = useState(false);
  const rows = sorted ? [...initial.records].sort((a, b) => a.quantity - b.quantity) : initial.records;
  return <><Task>{t('serverTask')}</Task><div className="panel"><div className="table-heading"><h2>{t('record')}</h2><button onClick={() => {
    setSorted((value) => !value); check('sorted', true);
  }}>{t('sort')} / {t('quantity')}</button></div><div className="table-scroll"><table><thead><tr><th>ID</th><th>{t('name')}</th><th>{t('quantity')}</th><th>{t('status')}</th></tr></thead>
    <tbody>{rows.map((row) => <tr key={row.id}><td><code>{row.id}</code></td><td>{t('record')} {row.id}</td><td>{row.quantity}</td><td>
      <button aria-label={`${t('select')} ${row.id}`} onClick={() => row.id === '042' && check('selected', row)}>{checks.selected?.id === row.id ? t('selected') : t('select')}</button></td></tr>)}</tbody></table></div></div>
    <Result value={Object.keys(checks).length ? checks : undefined} /></>;
};
export default Server;
