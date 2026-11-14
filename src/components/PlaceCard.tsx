import { useEffect, useState } from 'react';
import type { Place } from '../../shared/types';
import { localTimeIn } from '../lib/time';

interface Props {
  place: Place;
  /** Short facts about the place, shown as a numbered list. */
  facts?: readonly string[];
  /** Set to false when the surrounding screen already shows the name as its heading. */
  showName?: boolean;
}

/** Photo, name, local time and summary for one end of a dig. */
export default function PlaceCard({ place, facts, showName = true }: Props) {
  const clock = useLocalClock(place);
  // Remember which URL failed rather than a flag, so a new place gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photoMissing = !place.photoUrl || failedUrl === place.photoUrl;

  return (
    <article className="place">
      <figure className="place__photo">
        {photoMissing ? (
          <div className="place__nophoto">No photograph on file</div>
        ) : (
          <img src={place.photoUrl} alt={place.name} onError={() => setFailedUrl(place.photoUrl)} />
        )}
        {!photoMissing && <figcaption>{place.photoCredit}</figcaption>}
      </figure>

      {showName && <h3 className="place__name">{place.name}</h3>}
      <p className="place__meta">
        <span className={`tag ${place.isOcean ? 'tag--ocean' : 'tag--land'}`}>
          {place.isOcean ? 'Open ocean' : 'Dry land'}
        </span>
        {place.country && <span>{place.country}</span>}
        {clock && <span>Local time: {clock}</span>}
      </p>
      <p className="place__summary">{place.summary}</p>

      {facts && facts.length > 0 && (
        <ol className="facts">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ol>
      )}
    </article>
  );
}

/** The time at the place right now, refreshed while the card is on screen. */
function useLocalClock(place: Place): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return (place.timeZone && localTimeIn(place.timeZone, now)) || place.localTime;
}
