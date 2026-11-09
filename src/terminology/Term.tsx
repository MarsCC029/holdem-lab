import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { terms } from './terms';
import type { TermId } from './terms';
import './terminology.css';

export function Term({ id, children }: { id: TermId; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const titleId = useId();
  const definitionId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const term = terms[id];
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      // The only interactive element in this explanatory dialog is its close button.
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);
  return <span className="lab-term">
    <button ref={triggerRef} className={`lab-term-trigger ${term.category === '位置' ? 'lab-term-position' : ''}`} type="button" aria-expanded={open}
      aria-haspopup="dialog" aria-controls={open ? descriptionId : undefined} onClick={() => setOpen(true)} title={`解释：${term.chinese} · ${term.english}`}>
      {children ?? term.chinese}<span aria-hidden="true" className="lab-term-mark">?</span>
    </button>
    {open && createPortal(<div className="lab-term-shade" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="lab-term-dialog" id={descriptionId} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={definitionId}>
        <div className="lab-term-dialog-heading"><div><span>POKER GLOSSARY</span><h2 id={titleId}>{term.chinese}</h2></div>
          <button ref={closeRef} type="button" aria-label={`关闭${term.chinese}解释`} onClick={() => setOpen(false)}>×</button></div>
        <p className="lab-term-dialog-english">{term.english}</p>
        <p id={definitionId}>{term.definition}</p>
        <div className="lab-term-dialog-example"><strong>例如</strong><p>{term.example}</p></div>
        <small className="lab-term-dialog-hint">按 Esc 或点击空白处关闭</small>
      </section>
    </div>, document.body)}
  </span>;
}
