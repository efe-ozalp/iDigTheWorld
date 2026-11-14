import type { Dig, LatLon, Place } from '../../shared/types';

/** What the app knows so far about the far end of the tunnel. */
export type DestinationState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** `place` is null when nothing is known beyond the coordinates. */
  | { status: 'ready'; place: Place | null };

/** Stands in for network latency, so the loading path is exercised with mock data. */
const MOCK_LATENCY_MS = 1400;

/**
 * Finds out what is at the far end of the tunnel. Call it the moment a dig
 * starts, so the animation covers the wait.
 *
 * It never rejects: when the lookup fails or nothing is known, it resolves
 * with null and the app falls back to showing coordinates.
 *
 * For now it answers from the prepared dig, if the pin came from one. The real
 * lookups (geocoding, ocean detection, photo, grounding text) replace the body
 * of this function; callers do not change.
 */
export async function loadDestination(_exit: LatLon, dig: Dig | null): Promise<Place | null> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
  return dig?.destination ?? null;
}
