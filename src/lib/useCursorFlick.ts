import { useEffect, useRef } from 'react';

/** The throw has to carry the cursor into this strip along the bottom edge of the screen. */
const ZONE_TOP = 0.9;
/** A flick covers at least this far, this fast, within the sampling window. */
const MIN_DISTANCE_PX = 240;
const MIN_SPEED_PX_PER_MS = 2.6;
const WINDOW_MS = 110;
/** Sideways movement allowed, as a share of the downward distance. */
const MAX_DRIFT = 0.35;
/** Ignore the first moments, so the motion that opened the page cannot count. */
const ARM_DELAY_MS = 700;

/**
 * While armed, calls onFlick when the mouse cursor is thrown hard downward,
 * all the way into a thin strip along the bottom edge of the screen. No
 * button is pressed: it is the speed of the cursor alone. It is deliberately
 * hard to do by accident: reaching for an object, the scroll or a card, or
 * reading one, never counts.
 */
export function useCursorFlick(armed: boolean, onFlick: () => void): void {
  const onFlickRef = useRef(onFlick);
  useEffect(() => {
    onFlickRef.current = onFlick;
  });

  useEffect(() => {
    if (!armed) return;
    const armedAt = performance.now() + ARM_DELAY_MS;
    let trail: { t: number; x: number; y: number }[] = [];
    let fired = false;

    const onMove = (event: PointerEvent) => {
      if (fired || event.pointerType !== 'mouse' || event.buttons !== 0) return;
      const now = performance.now();
      if (now < armedAt) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('.scroll, .topic-plate, .object, .object-fallback')) {
        trail = [];
        return;
      }

      trail.push({ t: now, x: event.clientX, y: event.clientY });
      while (trail.length > 1 && now - trail[0].t > WINDOW_MS) trail.shift();

      const first = trail[0];
      const elapsed = now - first.t;
      const dy = event.clientY - first.y;
      const dx = event.clientX - first.x;
      if (
        event.clientY > window.innerHeight * ZONE_TOP &&
        elapsed > 0 &&
        dy >= MIN_DISTANCE_PX &&
        dy / elapsed >= MIN_SPEED_PX_PER_MS &&
        Math.abs(dx) <= dy * MAX_DRIFT
      ) {
        fired = true;
        onFlickRef.current();
      }
    };

    window.addEventListener('pointermove', onMove, true);
    return () => window.removeEventListener('pointermove', onMove, true);
  }, [armed]);
}
