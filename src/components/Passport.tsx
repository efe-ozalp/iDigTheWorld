import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { moveSticker, STICKER_BOUNDS, usePassport, type PassportSticker } from '../lib/passport';

interface Props {
  /** The day's place, named when the passport is still empty. */
  todaysPlace: string;
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** How far an arrow key moves a sticker, as a fraction of the passport. */
const NUDGE = 0.02;

/**
 * The open passport: two pages, with every sticker found so far. A sticker can
 * be dragged (or moved with the arrow keys) to anywhere on the two pages, and
 * stays where it is put.
 */
export default function Passport({ todaysPlace, onClose }: Props) {
  const stickers = usePassport();
  const pages = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="passport-veil" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="passport" role="dialog" aria-modal="true" aria-label="Your passport">
        <div className="passport__pages" ref={pages}>
          <div className="passport__page">
            <p className="eyebrow">iDigTheWorld</p>
            <h2 className="passport__title">Passport</h2>
            <p className="passport__lede">The explorer’s sticker pages</p>
            {stickers.length > 0 ? (
              <ol className="passport__entries">
                {stickers.map((sticker) => (
                  <li key={sticker.id}>{sticker.place}</li>
                ))}
              </ol>
            ) : (
              <p className="passport__empty">
                No stickers yet. Today’s Dig is {todaysPlace}: one is stuck to a card there, five layers down.
              </p>
            )}
          </div>
          <div className="passport__page passport__page--right">
            <p className="passport__tip">
              {stickers.length > 0
                ? 'Drag a sticker to stick it anywhere on these two pages.'
                : 'Stickers you peel off on your digs are kept here.'}
            </p>
          </div>

          {stickers.map((sticker) => (
            <PlacedSticker key={sticker.id} sticker={sticker} pages={pages} />
          ))}
        </div>

        <button ref={close} type="button" className="btn btn--small passport__close" onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  );
}

function PlacedSticker({ sticker, pages }: { sticker: PassportSticker; pages: RefObject<HTMLDivElement | null> }) {
  // While a sticker is in the hand it follows the pointer; it is saved when it is put down.
  const [held, setHeld] = useState<{ x: number; y: number } | null>(null);
  /** Where on the sticker it was picked up, so it does not jump to the pointer. */
  const grip = useRef({ x: 0, y: 0 });
  const at = held ?? sticker;

  const follow = (event: PointerEvent) => {
    const box = pages.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: clamp((event.clientX - grip.current.x - box.left) / box.width, STICKER_BOUNDS.minX, STICKER_BOUNDS.maxX),
      y: clamp((event.clientY - grip.current.y - box.top) / box.height, STICKER_BOUNDS.minY, STICKER_BOUNDS.maxY),
    };
  };

  const pickUp = (event: PointerEvent<HTMLButtonElement>) => {
    const box = pages.current?.getBoundingClientRect();
    if (!box) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    grip.current = {
      x: event.clientX - (box.left + sticker.x * box.width),
      y: event.clientY - (box.top + sticker.y * box.height),
    };
    setHeld({ x: sticker.x, y: sticker.y });
  };

  const carry = (event: PointerEvent) => {
    if (held) setHeld(follow(event) ?? held);
  };

  const putDown = () => {
    if (!held) return;
    moveSticker(sticker.id, held.x, held.y);
    setHeld(null);
  };

  const nudge = (event: KeyboardEvent) => {
    const step = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] }[event.key];
    if (!step) return;
    event.preventDefault();
    moveSticker(sticker.id, sticker.x + step[0], sticker.y + step[1]);
  };

  return (
    <button
      type="button"
      className={held ? 'passport__sticker passport__sticker--held' : 'passport__sticker'}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%`, '--tilt': `${sticker.tilt}deg` } as CSSProperties}
      aria-label={`${sticker.place} sticker. Drag it, or use the arrow keys, to move it.`}
      onPointerDown={pickUp}
      onPointerMove={carry}
      onPointerUp={putDown}
      onPointerCancel={putDown}
      onKeyDown={nudge}
    >
      <img src={sticker.image} alt="" draggable={false} />
    </button>
  );
}
