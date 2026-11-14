import { useEffect, useState } from 'react';
import type { Place } from '../../shared/types';
import { localTimeIn } from './time';

/**
 * The time at a place right now, kept current while the component is on
 * screen. Uses the place's time zone when it has one, and otherwise the time
 * recorded when the place was looked up.
 */
export function useLocalClock(place: Place | null): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  if (!place) return '';
  return (place.timeZone && localTimeIn(place.timeZone, now)) || place.localTime;
}
