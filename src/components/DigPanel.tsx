import type { Dig, LatLon, Place } from '../../shared/types';
import { EARTH_DIAMETER_KM, formatCoords } from '../lib/geo';
import PlaceCard from './PlaceCard';

export type Side = 'origin' | 'exit';

interface Props {
  origin: LatLon | null;
  exit: LatLon | null;
  /** The prepared dig the pin came from, or null for a free click on the globe. */
  dig: Dig | null;
  sampleDigs: Dig[];
  /** Which end of the tunnel the globe is currently turned toward. */
  viewing: Side;
  onPickSample: (dig: Dig) => void;
  onToggleView: () => void;
  onReset: () => void;
}

/** The three overview facts written for a place, if the dig has them. */
function overviewFacts(dig: Dig, place: Place): readonly string[] | undefined {
  return dig.cards.find((c) => c.placeName === place.name && c.topicPath.length === 0)?.facts;
}

export default function DigPanel({
  origin,
  exit,
  dig,
  sampleDigs,
  viewing,
  onPickSample,
  onToggleView,
  onReset,
}: Props) {
  return (
    <aside className="panel">
      {origin && exit ? (
        <>
          <section className="stop">
            <h2 className="stop__heading">
              <span className="callout">1</span> You start here
            </h2>
            <p className="coords">{formatCoords(origin)}</p>
            {dig && <PlaceCard place={dig.origin} facts={overviewFacts(dig, dig.origin)} />}
          </section>

          <p className="tunnel">
            Straight down through the centre of the Earth, about {EARTH_DIAMETER_KM.toLocaleString('en-US')} km
          </p>

          <section className="stop">
            <h2 className="stop__heading">
              <span className="callout callout--exit">2</span> You come out here
            </h2>
            <p className="coords">{formatCoords(exit)}</p>
            {dig && <PlaceCard place={dig.destination} />}
          </section>

          {!dig && (
            <p className="note">
              Names, photos and facts for any spot you pick arrive with live data in phase 3. Until then, the sample
              digs below show a complete start and finish.
            </p>
          )}

          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={onToggleView}>
              {viewing === 'origin' ? 'See the other side' : 'Back to my digger'}
            </button>
            <button type="button" className="btn" onClick={onReset}>
              Start over
            </button>
          </div>
        </>
      ) : (
        <section className="intro">
          <h2 className="panel__title">Where shall we dig?</h2>
          <p className="panel__lede">
            Spin the globe, then click any spot to set your digger down. A yellow flag marks the place where a tunnel
            straight through the centre of the Earth would come out.
          </p>
        </section>
      )}

      <section className="samples">
        <h2 className="eyebrow">Sample digs</h2>
        <ul className="samples__list">
          {sampleDigs.map((sample) => (
            <li key={sample.id}>
              <button
                type="button"
                className="btn sample"
                aria-pressed={dig?.id === sample.id}
                onClick={() => onPickSample(sample)}
              >
                <span>
                  {sample.origin.name} to {sample.destination.name}
                </span>
                <span className={`tag ${sample.destination.isOcean ? 'tag--ocean' : 'tag--land'}`}>
                  {sample.destination.isOcean ? 'Ocean' : 'Land'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
