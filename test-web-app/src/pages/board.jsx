import { useRef, useState } from 'react';
import { useLab } from '../context.jsx';
import { Task, Result, useChecks } from '../components/scenario.jsx';

const Board = () => {
  const { t } = useLab(); const { check, checks } = useChecks(['board', 'order']);
  const [cards, setCards] = useState({ backlog: [1, 2, 3], inProgress: [], done: [] });
  const [rows, setRows] = useState([1, 2, 3]); const dragging = useRef(null);
  const move = (target) => {
    const source = dragging.current; dragging.current = null;
    if (!source) return;
    if (source.type === 'card') {
      const next = Object.fromEntries(Object.entries(cards).map(([key, values]) => [key, values.filter((value) => value !== source.id)]));
      next[target].push(source.id); setCards(next);
      if (next.done.length === 3) check('board', next);
    } else {
      const next = rows.filter((value) => value !== source.id); next.splice(rows.indexOf(Number(target)), 0, source.id); setRows(next);
      if (next.toString() === '3,2,1') check('order', next);
    }
  };
  const start = (event, type, id) => { dragging.current = { type, id }; event.dataTransfer?.setData('text/plain', String(id)); };
  const drop = (event, target) => {
    event.preventDefault();
    if (dragging.current?.type === (typeof target === 'string' ? 'card' : 'row')) move(target);
  };
  return <><Task>{t('boardTask')}</Task><div className="kanban">{Object.entries(cards).map(([column, values]) => <section key={column} className="kanban-column"
    aria-label={t(column)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, column)} onPointerUp={() => dragging.current?.type === 'card' && move(column)}>
    <h2>{t(column)}<span>{values.length}</span></h2>{values.map((id) => <div key={id} draggable className="drag-card" tabIndex={0} onDragStart={(event) => start(event, 'card', id)}
      onPointerDown={(event) => start(event, 'card', id)}><span className="drag-handle">⠿</span><strong>{t('item')} {String(id).padStart(2, '0')}</strong><small>#{id}</small></div>)}</section>)}</div>
    <div className="panel sortable"><h2>{t('reorder')}</h2>{rows.map((id) => <div key={id} className="sort-row" draggable tabIndex={0}
      onDragStart={(event) => start(event, 'row', id)} onPointerDown={(event) => start(event, 'row', id)} onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => drop(event, id)} onPointerUp={() => dragging.current?.type === 'row' && move(id)}><span>⠿</span>{t('item')} {id}</div>)}</div>
    <Result value={Object.keys(checks).length ? checks : undefined} /></>;
};
export default Board;
