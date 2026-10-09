import { useState } from 'react';
import { useLab } from '../context.jsx';

export const VirtualList = ({ count = 1000, onSelect, selected }) => {
  const { t } = useLab(); const [top, setTop] = useState(0);
  const height = 54; const start = Math.max(0, Math.floor(top / height) - 2);
  const indexes = Array.from({ length: Math.min(12, count - start) }, (_, index) => start + index);
  return <div className="virtual-list" role="region" aria-label={t('scroll')} tabIndex={0} onScroll={(event) => setTop(event.currentTarget.scrollTop)}>
    <div style={{ height: count * height, position: 'relative' }}>{indexes.map((index) => {
      const id = String(index).padStart(3, '0');
      return <div className={`virtual-row ${selected === id ? 'is-selected' : ''}`} key={index} style={{ position: 'absolute', insetInline: 0, top: index * height, height }}>
        <code>{id}</code><span>{t('record')} {id}</span><button aria-label={`${t('select')} ${id}`} onClick={() => onSelect(id)}>{selected === id ? t('selected') : t('select')}</button></div>;
    })}</div>
  </div>;
};
