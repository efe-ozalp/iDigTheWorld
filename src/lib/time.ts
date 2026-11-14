/**
 * Wall-clock time in an IANA time zone, e.g. "Saturday 9:41 PM".
 * Returns null if this browser doesn't know the zone, so callers can fall back.
 */
export function localTimeIn(timeZone: string, at: Date = new Date()): string | null {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(at);
  } catch {
    return null;
  }
}
