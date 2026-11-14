import { DIGGER_FIGURE, DIGGER_SHADOW, FLAG } from '../art/sprites';

/**
 * The two things globe.gl pins to the Earth's surface: the digger at the
 * starting point and the flag at the antipode. They are plain DOM nodes
 * because the globe library places HTML elements itself, outside React.
 * Styling lives under `.marker` in app.css.
 */

export type MarkerKind = 'digger' | 'flag';

const svg = (width: number, height: number, body: string) =>
  `<svg class="marker__art" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">${body}</svg>`;

const MARKUP: Record<MarkerKind, string> = {
  digger: svg(48, 64, DIGGER_SHADOW + DIGGER_FIGURE),
  flag: svg(40, 56, FLAG),
};

/**
 * Builds the node for one marker. The wrapper is a 0 by 0 box that the globe
 * positions exactly on the coordinate; the artwork is anchored inside it so
 * the digger's feet (or the foot of the flagpole) touch the ground there.
 */
export function createMarkerElement(kind: MarkerKind): HTMLElement {
  const el = document.createElement('div');
  el.className = `marker marker--${kind}`;
  el.innerHTML = MARKUP[kind];
  return el;
}
