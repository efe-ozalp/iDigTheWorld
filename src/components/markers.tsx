import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import ExitFlag from './ExitFlag';
import Explorer from './Explorer';

/**
 * The two things globe.gl pins to the Earth's surface: the explorer at the
 * starting point and the flag at the antipode. The globe library creates and
 * places these nodes itself, outside the app's React tree.
 * Styling lives under `.marker` in app.css.
 */

export type MarkerKind = 'explorer' | 'flag';

const ART: Record<MarkerKind, ReactNode> = {
  explorer: (
    <svg className="marker__art" viewBox="0 0 48 64" width="48" height="64" aria-hidden="true">
      <Explorer shadow />
    </svg>
  ),
  flag: (
    <svg className="marker__art" viewBox="0 0 40 56" width="40" height="56" aria-hidden="true">
      <ExitFlag />
    </svg>
  ),
};

/**
 * Builds the node for one marker. The wrapper is a 0 by 0 box that the globe
 * positions exactly on the coordinate; the artwork is anchored inside it so
 * the explorer's feet (or the foot of the flagpole) touch the ground there.
 */
export function createMarkerElement(kind: MarkerKind): HTMLElement {
  const el = document.createElement('div');
  el.className = `marker marker--${kind}`;
  // The globe owns this node, so its artwork is drawn by a small React root of its own.
  createRoot(el).render(ART[kind]);
  return el;
}
