import { useEffect, useRef } from 'react';
import type { LatLon, Place } from '../../shared/types';
import { EARTH_DIAMETER_KM, formatCoords } from '../lib/geo';
import PlaceCard from './PlaceCard';

interface Props {
  exit: LatLon;
  /** What is at the far end, or null when only the coordinates are known. */
  place: Place | null;
  onShowOnGlobe: () => void;
  onDigElsewhere: () => void;
}

/** What the digger finds on surfacing. A stand-in for the full surface screen. */
export default function ArrivalCard({ exit, place, onShowOnGlobe, onDigElsewhere }: Props) {
  // Hand keyboard and screen-reader focus to the card, starting at its heading.
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    card.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="arrival" ref={card} tabIndex={-1} aria-labelledby="arrival-title">
      <p className="eyebrow">You made it through</p>
      <h2 id="arrival-title" className="arrival__title">
        {place ? place.name : 'The other side of the world'}
      </h2>
      <p className="arrival__lede">
        {EARTH_DIAMETER_KM.toLocaleString('en-US')} km of digging brings you up at {formatCoords(exit)}
        {place?.isOcean ? ', in open water.' : '.'}
      </p>

      {place ? (
        <PlaceCard place={place} showName={false} />
      ) : (
        <p className="note">
          Names, photos and facts for the far side arrive with live data in phase 3. The sample digs show a complete
          arrival.
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onShowOnGlobe}>
          See it on the globe
        </button>
        <button type="button" className="btn" onClick={onDigElsewhere}>
          Dig somewhere else
        </button>
      </div>
    </section>
  );
}
