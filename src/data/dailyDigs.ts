import type { LatLon, Topic } from '../../shared/types';
import { distanceKm } from '../lib/geo';

/**
 * Today's Dig: one place a day hides a sticker on the deepest card of one of
 * its topics. Finding it means digging all the way down to bedrock there.
 *
 * The sticker pictures are the team's own PNGs in /public/stickers, used
 * exactly as supplied.
 */
export interface DailyDig {
  /** Also the sticker's ID in the passport. */
  id: string;
  /** The place's name, as shown in the "Today's Dig" tag. */
  name: string;
  point: LatLon;
  /** The topic whose bedrock card carries the sticker. */
  topic: Topic;
  /** The sticker's picture. */
  sticker: string;
}

declare const __BUILD_ID__: string;

/** One is picked per day. For the demo there is only Madison, so it is always Madison. */
const DAILY_DIGS: readonly DailyDig[] = [
  {
    id: 'madison',
    name: 'Madison',
    point: { lat: 43.0747, lon: -89.3842 },
    topic: 'history',
    sticker: `/stickers/madison.png?v=${__BUILD_ID__}`,
  },
];

/** How close a spot must be to count as the day's place. */
const NEAR_KM = 40;

/** The day's place. It changes at local midnight and is the same for everyone on a given date. */
export function todaysDig(now = new Date()): DailyDig {
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  // Scramble the day number so consecutive days do not simply walk the list in order.
  const pick = Math.abs(Math.floor(Math.sin(day * 12.9898) * 43758.5453)) % DAILY_DIGS.length;
  return DAILY_DIGS[pick];
}

/** Whether a spot on the globe is the day's place. */
export function isDailyDig(dig: DailyDig, point: LatLon): boolean {
  return distanceKm(dig.point, point) <= NEAR_KM;
}
