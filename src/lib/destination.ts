import type { Dig, LatLon } from '../../shared/types';
import { findCard } from './cards';
import { lookupPlace, type PlaceLookup } from './place';

/** What the app knows so far about the far end of the tunnel. */
export type DestinationState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** `found` is null when nothing is known beyond the coordinates. */
  | { status: 'ready'; found: PlaceLookup | null };

/**
 * Finds out what is at the far end of the tunnel. Call it the moment a dig
 * starts, so the animation covers the wait. It never rejects.
 *
 * A prepared dig answers from its own data, with no network. Any other spot
 * is looked up live.
 */
export async function loadDestination(exit: LatLon, dig: Dig | null): Promise<PlaceLookup | null> {
  if (!dig) return lookupPlace(exit);
  return { place: dig.destination, facts: [...(findCard(dig.cards, dig.destination.name, [])?.facts ?? [])] };
}
