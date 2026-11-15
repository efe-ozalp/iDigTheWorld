import { useSyncExternalStore } from 'react';

/**
 * The passport: the stickers the explorer has peeled off, and where each one
 * has been stuck on the passport's two pages. Kept in `localStorage`, so it
 * survives a reload; without storage it simply lasts for the visit.
 */
export interface PassportSticker {
  id: string;
  image: string;
  /** Where it was found, e.g. "Madison". */
  place: string;
  /** The sticker's centre, as fractions (0 to 1) of the open passport's width and height. */
  x: number;
  y: number;
  /** A casual tilt, in degrees. */
  tilt: number;
}

const KEY = 'idig:passport:v1';

/** How close to the passport's edge a sticker's centre may go. */
export const STICKER_BOUNDS = { minX: 0.1, maxX: 0.9, minY: 0.16, maxY: 0.84 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isSticker(value: unknown): value is PassportSticker {
  const s = value as Partial<PassportSticker> | null;
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    typeof s.image === 'string' &&
    typeof s.place === 'string' &&
    Number.isFinite(s.x) &&
    Number.isFinite(s.y) &&
    Number.isFinite(s.tilt)
  );
}

function read(): PassportSticker[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isSticker) : [];
  } catch {
    return [];
  }
}

let stickers: PassportSticker[] = read();
const listeners = new Set<() => void>();

function write(next: PassportSticker[]): void {
  stickers = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage is full or blocked: the passport still works until the page closes.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The stickers in the passport, kept up to date. */
export function usePassport(): readonly PassportSticker[] {
  return useSyncExternalStore(subscribe, () => stickers);
}

/** Adds a sticker, loose in the middle of the right-hand page. A sticker already held is left alone. */
export function collectSticker(found: Pick<PassportSticker, 'id' | 'image' | 'place'>): void {
  if (stickers.some((sticker) => sticker.id === found.id)) return;
  // Later stickers land a little lower, so they do not hide each other.
  const y = clamp(0.5 + stickers.length * 0.06, STICKER_BOUNDS.minY, STICKER_BOUNDS.maxY);
  write([...stickers, { ...found, x: 0.75, y, tilt: -6 }]);
}

/** Sticks a sticker down somewhere else on the two pages. */
export function moveSticker(id: string, x: number, y: number): void {
  write(
    stickers.map((sticker) =>
      sticker.id === id
        ? {
            ...sticker,
            x: clamp(x, STICKER_BOUNDS.minX, STICKER_BOUNDS.maxX),
            y: clamp(y, STICKER_BOUNDS.minY, STICKER_BOUNDS.maxY),
          }
        : sticker,
    ),
  );
}
