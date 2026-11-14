import { useCallback, useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import type { NotesSection } from '../lib/fieldNotes';

interface Props {
  sections: readonly NotesSection[];
  /** Phones get a "Field notes" button that opens a full-width sheet instead of the scroll. */
  compact: boolean;
}

/** How long the scroll stays open after the pointer leaves it. */
const CLOSE_DELAY_MS = 300;

function Notes({ sections }: { sections: readonly NotesSection[] }) {
  return (
    <div className="notes">
      <p className="notes__title">Field notes</p>
      {sections.map((section) => (
        <section key={section.id} className="notes__section">
          <h3 className="notes__heading">{section.heading}</h3>

          {section.kind === 'summary' && (
            <>
              <p className="notes__summary">{section.text}</p>
              {section.source && (
                <p className="notes__source">
                  Source:{' '}
                  <a href={section.source.url} target="_blank" rel="noreferrer">
                    {section.source.label}
                  </a>
                </p>
              )}
            </>
          )}

          {section.kind === 'facts' && (
            <ol className="notes__facts">
              {section.facts.map((fact, i) => (
                <li key={fact}>
                  <span className="notes__marker">{i + 1}</span>
                  {fact}
                </li>
              ))}
            </ol>
          )}

          {section.kind === 'rows' && (
            <dl className="notes__rows">
              {section.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * The field notes for the place at the far end of the tunnel.
 *
 * On a wide screen they are a rolled parchment scroll at the left edge. It
 * unrolls while the mouse is over it, and a click, tap, Enter or Space on the
 * roll pins it open; a second click or Escape closes it.
 */
export default function FieldNotes({ sections, compact }: Props) {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointerInside = useRef(false);
  // After a deliberate close, the mouse still resting on the scroll must not reopen it.
  const hoverBlocked = useRef(false);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    hoverBlocked.current = pointerInside.current;
    setPinned(false);
    setHovered(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  if (compact) {
    return (
      <>
        <button
          type="button"
          className="btn notes-button"
          aria-expanded={pinned}
          aria-controls={id}
          onClick={() => setPinned(!pinned)}
        >
          Field notes
        </button>
        {pinned && (
          <div className="sheet" id={id} role="dialog" aria-label="Field notes">
            <button type="button" className="btn btn--small sheet__close" onClick={close}>
              Close
            </button>
            <Notes sections={sections} />
          </div>
        )}
      </>
    );
  }

  // Hovering is a mouse idea; touches and pens open the scroll by tapping the roll.
  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    pointerInside.current = true;
    clearTimeout(closeTimer.current);
    if (!hoverBlocked.current) setHovered(true);
  };

  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    pointerInside.current = false;
    hoverBlocked.current = false;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
  };

  return (
    <aside
      className={open ? 'scroll is-open' : 'scroll'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        type="button"
        className="scroll__roll scroll__handle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => (pinned ? close() : setPinned(true))}
      >
        <span className="scroll__tag">Field notes</span>
      </button>

      <div className="scroll__paper" id={id} role="region" aria-label="Field notes" inert={!open}>
        <div className="scroll__page">
          <Notes sections={sections} />
        </div>
      </div>

      <span className="scroll__roll" aria-hidden="true" />
      <span className="scroll__ribbon" aria-hidden="true" />
    </aside>
  );
}
