import { useEffect, useState } from 'react';
import { useLab } from '../context.jsx';

const eventNames = ['pointerdown', 'pointerup', 'click', 'dblclick', 'contextmenu', 'keydown', 'keyup', 'beforeinput', 'input', 'change', 'focusin', 'drop', 'compositionstart', 'compositionupdate', 'compositionend'];
export const EventLog = () => {
  const { t, route } = useLab();
  const [events, setEvents] = useState([]);
  useEffect(() => {
    setEvents([]);
    const record = (event) => {
      if (!event.composedPath().some((node) => node?.dataset?.testSurface !== undefined)) return;
      const target = event.composedPath()[0];
      const entry = { type: event.type, target: target?.getAttribute?.('aria-label') || target?.name || target?.id || target?.tagName,
        trusted: event.isTrusted, key: event.key, inputType: event.inputType, value: target?.value, time: new Date().toLocaleTimeString() };
      setEvents((previous) => [...previous.slice(-39), entry]);
    };
    eventNames.forEach((name) => document.addEventListener(name, record, true));
    return () => eventNames.forEach((name) => document.removeEventListener(name, record, true));
  }, [route.id]);
  return <details className="event-log"><summary>{t('eventLog')} <span>{events.length}</span></summary>
    <p>{t('eventHint')}</p><button onClick={() => setEvents([])}>{t('clear')}</button>
    <div className="events">{events.map((event, index) => <div key={index}><code>{event.type}</code><span>{event.target}</span>
      <span className={event.trusted ? 'trusted' : ''}>{event.trusted ? t('trusted') : t('scripted')}</span><code>{event.key || event.inputType || ''}</code></div>)}</div>
  </details>;
};
