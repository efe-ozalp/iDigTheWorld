import { useEffect, useRef } from 'react';

/** A flick is a quick, mostly vertical, downward drag. */
const FLICK_MIN_DISTANCE_PX = 56;
const FLICK_MAX_MS = 650;
/** Sideways movement allowed, as a share of the downward distance. */
const FLICK_MAX_DRIFT = 0.6;

const CONTROLS = 'button, a, input, select, textarea, [contenteditable="true"]';
const TEXT_FIELDS = 'input, select, textarea, [contenteditable="true"]';

/** True when a press lands on an element's own scrollbar instead of its content. */
function isOnScrollbar(event: PointerEvent, target: Element | null): boolean {
  if (!(target instanceof HTMLElement) || target.scrollHeight <= target.clientHeight) return false;
  const pressX = event.clientX - target.getBoundingClientRect().left;
  return pressX > target.clientLeft + target.clientWidth;
}

/**
 * While armed, calls onDig for the two hands-on ways to start a dig: a
 * downward flick anywhere on the page, or the down-arrow key. (The third way,
 * the Dig! button, is an ordinary button.)
 *
 * Presses that begin on a button, link, form field or scrollbar are ignored,
 * so using those never starts a dig by accident.
 */
export function useDigTriggers(armed: boolean, onDig: () => void): void {
  const onDigRef = useRef(onDig);
  useEffect(() => {
    onDigRef.current = onDig;
  });

  useEffect(() => {
    if (!armed) return;

    let press: { id: number; x: number; y: number; time: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      press = null;
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(CONTROLS) || isOnScrollbar(event, target)) return;
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!press || event.pointerId !== press.id) return;
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      const elapsed = event.timeStamp - press.time;
      press = null;
      if (dy >= FLICK_MIN_DISTANCE_PX && elapsed <= FLICK_MAX_MS && Math.abs(dx) <= dy * FLICK_MAX_DRIFT) {
        onDigRef.current();
      }
    };

    // The browser cancels the pointer when a touch turns into a native scroll,
    // which is how scrolling a page on a phone avoids counting as a flick.
    const onPointerCancel = () => {
      press = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' || event.repeat) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TEXT_FIELDS)) return;
      event.preventDefault();
      onDigRef.current();
    };

    // Capture phase, so the globe's own pointer handling cannot hide the events.
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [armed]);
}
