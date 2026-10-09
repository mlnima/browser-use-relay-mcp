import { useState } from 'react';
import { useLab } from '../context.jsx';
import { Result, Task, useChecks } from '../components/scenario.jsx';
import { VirtualList } from '../components/virtual-list.jsx';

const Scroll = () => {
  const { t } = useLab(); const { check, checks } = useChecks(['row', 'bottom']); const [selected, setSelected] = useState('');
  return <><Task>{t('scrollTask')}</Task><div className="two-columns"><div className="panel"><h2>{t('record')} / 1,000</h2>
    <VirtualList selected={selected} onSelect={(id) => { setSelected(id); if (id === '042') check('row', id); }} /></div>
    <div className="panel"><h2>{t('bottomMarker')}</h2><div className="nested-scroll"><div className="sticky-strip">{t('scroll')}</div>
      <div className="wide-content">{Array.from({ length: 24 }, (_, index) => <div className="scroll-block" key={index}>{t('item')} {index + 1}<span>↔</span></div>)}
        <button className="primary bottom-target" onClick={() => check('bottom', true)}>{t('bottomMarker')}</button></div></div></div></div>
    <Result value={Object.keys(checks).length ? checks : undefined} /></>;
};
export default Scroll;
