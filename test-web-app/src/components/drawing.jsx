import { useRef } from 'react';
import { useLab } from '../context.jsx';

export const Drawing = ({ onStroke }) => {
  const { t } = useLab(); const canvas = useRef(null); const points = useRef(0);
  const position = (event) => {
    const rect = canvas.current.getBoundingClientRect();
    return [(event.clientX - rect.left) * 640 / rect.width, (event.clientY - rect.top) * 260 / rect.height];
  };
  return <div className="panel"><h2>{t('canvas')}</h2><canvas ref={canvas} className="drawing-canvas" width="640" height="260" aria-label={t('canvas')}
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const context = canvas.current.getContext('2d');
      context.beginPath(); context.moveTo(...position(event)); context.strokeStyle = '#f2663b'; context.lineWidth = 5; points.current = 1; }}
    onPointerMove={(event) => { if (event.buttons && points.current) { const context = canvas.current.getContext('2d'); context.lineTo(...position(event)); context.stroke(); points.current += 1; } }}
    onPointerUp={() => { if (points.current > 2) onStroke(points.current); points.current = 0; }} />
    <button onClick={() => canvas.current.getContext('2d').clearRect(0, 0, 640, 260)}>{t('clear')}</button></div>;
};
