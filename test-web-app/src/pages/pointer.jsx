import { useEffect, useRef, useState } from 'react';
import { useLab } from '../context.jsx';
import { Result, Task, useChecks } from '../components/scenario.jsx';

const Pointer = () => {
  const { t } = useLab(); const { check, checks } = useChecks(['hover', 'double', 'context', 'hold', 'slider', 'moving']);
  const [menu, setMenu] = useState(false); const [slider, setSlider] = useState(0); const [offset, setOffset] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    if (checks.moving) return;
    const timer = setInterval(() => setOffset((value) => value === 0 ? 58 : 0), 1500);
    return () => clearInterval(timer);
  }, [checks.moving]);
  return <><Task>{t('pointerTask')} {t('movingTarget')}.</Task><div className="interaction-grid">
    <div className="interaction-tile hover-tile" tabIndex={0}><span className="tile-number">01</span><h2>{t('hover')}</h2>
      <div className="hover-menu"><button onClick={() => check('hover', true)}>{t('confirm')}</button></div></div>
    <div className="interaction-tile" onDoubleClick={() => check('double', true)} tabIndex={0} role="button" aria-label={t('doubleClick')}>
      <span className="tile-number">02</span><h2>{t('doubleClick')}</h2></div>
    <div className="interaction-tile context-tile" onContextMenu={(event) => { event.preventDefault(); setMenu(true); }} tabIndex={0}>
      <span className="tile-number">03</span><h2>{t('contextMenu')}</h2>{menu && <div className="context-menu" role="menu">
        <button role="menuitem" onClick={() => { check('context', true); setMenu(false); }}>{t('confirm')}</button>
        <button role="menuitem" onClick={() => setMenu(false)}>{t('cancel')}</button></div>}</div>
    <button className="interaction-tile" onPointerDown={(event) => { start.current = performance.now(); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerUp={() => { const duration = Math.round(performance.now() - start.current); if (duration >= 1000) check('hold', { durationMs: duration }); }}>
      <span className="tile-number">04</span><h2>{t('hold')}</h2></button>
    <label className="interaction-tile"><span className="tile-number">05</span><h2>{t('slider')}</h2><input type="range" min="0" max="100" value={slider}
      onChange={(event) => { const value = Number(event.target.value); setSlider(value); if (value > 0) check('slider', value); }} /><output>{slider}</output></label>
    <div className="interaction-tile moving-tile"><span className="tile-number">06</span><h2>{t('movingTarget')}</h2><button style={{ marginInlineStart: `${offset}%` }}
      onClick={() => check('moving', true)}>{t('confirm')}</button></div>
  </div><Result value={Object.keys(checks).length ? checks : undefined} /></>;
};
export default Pointer;
