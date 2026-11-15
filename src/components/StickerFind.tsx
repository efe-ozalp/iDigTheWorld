import { useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { DailyDig } from '../data/dailyDigs';
import { collectSticker, usePassport } from '../lib/passport';

interface Props {
  dig: DailyDig;
}

/** Where the peeled sticker starts, and how far it flies to the passport's corner. */
interface Flight {
  left: number;
  top: number;
  width: number;
  dx: number;
  dy: number;
}

/**
 * The sticker stuck to the day's bedrock card. Clicking it peels it off: it
 * lifts away from the card, then flies to the bottom-right corner, where the
 * passport is kept on the globe view.
 */
export default function StickerFind({ dig }: Props) {
  const held = usePassport().some((sticker) => sticker.id === dig.id);
  const [flight, setFlight] = useState<Flight | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  const peel = () => {
    const box = button.current?.getBoundingClientRect();
    if (box && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFlight({
        left: box.left,
        top: box.top,
        width: box.width,
        dx: window.innerWidth - 80 - (box.left + box.width / 2),
        dy: window.innerHeight - 80 - (box.top + box.height / 2),
      });
    }
    // Kept at once, so closing the card mid-flight cannot lose it.
    collectSticker({ id: dig.id, image: dig.sticker, place: dig.name });
  };

  return (
    <div className="sticker-find">
      {held ? (
        <p className="sticker-find__note" role="status">
          <strong>Sticker peeled!</strong> It is in your passport. Open the passport from the globe, at the bottom
          right, and stick it wherever you like.
        </p>
      ) : (
        <>
          <button
            ref={button}
            type="button"
            className="sticker"
            onClick={peel}
            aria-label={`Peel off the ${dig.name} sticker`}
          >
            <img src={dig.sticker} alt="" draggable={false} />
          </button>
          <p className="sticker-find__note">
            <strong>Something is stuck to the bedrock.</strong> Peel it off for your passport!
          </p>
        </>
      )}
      {flight &&
        createPortal(
          <img
            className="sticker-fly"
            src={dig.sticker}
            alt=""
            style={
              {
                left: flight.left,
                top: flight.top,
                width: flight.width,
                '--dx': `${flight.dx}px`,
                '--dy': `${flight.dy}px`,
              } as CSSProperties
            }
            onAnimationEnd={() => setFlight(null)}
          />,
          document.body,
        )}
    </div>
  );
}
