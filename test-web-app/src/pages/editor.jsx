import { useRef, useState } from 'react';
import { useLab } from '../context.jsx';
import { Task, Result, useChecks } from '../components/scenario.jsx';

const Editor = () => {
  const { t } = useLab(); const { checks, check } = useChecks(['saved']);
  const editor = useRef(null); const [destination, setDestination] = useState(''); const [error, setError] = useState('');
  const format = (tag) => {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed || !editor.current.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0), wrapper = document.createElement(tag);
    wrapper.append(range.extractContents()); range.insertNode(wrapper); selection.removeAllRanges();
    range.selectNodeContents(wrapper); selection.addRange(range); editor.current.focus();
  };
  const save = () => {
    if (editor.current.textContent && destination && editor.current.querySelector('strong,em'))
      check('saved', { text: editor.current.textContent, html: editor.current.innerHTML, clipboard: destination });
  };
  return <><Task>{t('editorTask')}</Task><div className="panel editor-panel"><div className="editor-toolbar">
    <button onPointerDown={(event) => event.preventDefault()} onClick={() => format('strong')}>{t('bold')}</button>
    <button onPointerDown={(event) => event.preventDefault()} onClick={() => format('em')}>{t('italic')}</button>
    <button onClick={async () => { try { await navigator.clipboard.writeText(window.getSelection().toString() || editor.current.textContent); } catch (failure) { setError(failure.message); } }}>{t('copy')}</button>
    <button onClick={() => { editor.current.replaceChildren(); editor.current.focus(); }}>{t('clear')}</button></div>
    <div className="rich-editor" ref={editor} role="textbox" contentEditable suppressContentEditableWarning aria-label={t('richText')} aria-multiline="true" />
    <p className="shortcut-hint">Ctrl / Meta + A · C · V · Z · Shift + Z</p>
    <label>{t('clipboard')}<textarea value={destination} onChange={(event) => setDestination(event.target.value)} rows={3} /></label>
    <div className="button-row"><button onClick={async () => { try { setDestination(await navigator.clipboard.readText()); } catch (failure) { setError(failure.message); } }}>{t('paste')}</button>
      <button className="primary" onClick={save}>{t('save')}</button></div>{error && <p role="alert">{t('failed')}: {error}</p>}
  </div><Result value={checks.saved} /></>;
};
export default Editor;
