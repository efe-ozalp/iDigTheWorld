import { useState } from 'react';
import type { Place } from '../../shared/types';
import { useLocalClock } from '../lib/useLocalClock';

interface Props {
  place: Place;
  /** Short facts about the place, shown as a numbered list. */
  facts?: readonly string[];
}

/** Photo, name, local time and summary for one end of a dig. */
export default function PlaceCard({ place, facts }: Props) {
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
        {!photoMissing && (
          <figcaption>
            {place.photoPageUrl ? (
              <a href={place.photoPageUrl} target="_blank" rel="noreferrer">
                {place.photoCredit}
              </a>
            ) : (
              place.photoCredit
            )}
          </figcaption>
        )}
      </figure>

      <h3 className="place__name">{place.name}</h3>
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
