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
  /** True while the dig scene covers the panel, to keep focus and clicks out of it. */
  hidden: boolean;
  onDig: () => void;
  onPickSample: (dig: Dig) => void;
  onToggleView: () => void;
  /** Closes the origin card and frees the globe so another spot can be found. */
  onClose: () => void;
}

/** The three overview facts written for a place, if the dig has them. */
function overviewFacts(dig: Dig, place: Place): readonly string[] | undefined {
  return dig.cards.find((c) => c.placeName === place.name && c.topicPath.length === 0)?.facts;
}

/** The side panel: an invitation to pick a spot, then the origin card for the spot picked. */
export default function DigPanel({
  origin,
  exit,
  dig,
  sampleDigs,
  viewing,
  hidden,
  onDig,
  onPickSample,
  onToggleView,
  onClose,
}: Props) {
  return (
    <aside className="panel" inert={hidden}>
      {origin && exit ? (
        <>
          <section className="stop">
            <h2 className="stop__heading">
              <span className="callout">1</span> You start here
            </h2>
            <p className="coords">{formatCoords(origin)}</p>
            {dig ? (
              <PlaceCard place={dig.origin} facts={overviewFacts(dig, dig.origin)} />
            ) : (
              <p className="note note--inset">
                Names, photos and facts for any spot you pick arrive with live data in phase 3. The sample digs below
                show a complete trip.
              </p>
            )}
          </section>

          <p className="tunnel">
            Straight down through the centre of the Earth, about {EARTH_DIAMETER_KM.toLocaleString('en-US')} km
          </p>

          <section className="stop">
            <h2 className="stop__heading">
              <span className="callout callout--exit">2</span> You will come out here
            </h2>
            <p className="coords">{formatCoords(exit)}</p>
            <p className="stop__teaser">What is there? Dig to find out.</p>
          </section>

          <div className="dig-bar">
            <div className="dig-bar__main">
              <button type="button" className="btn btn--primary btn--dig" onClick={onDig}>
                Dig!
              </button>
              <p className="dig-bar__hint">or flick down anywhere, or press the ↓ key</p>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={onToggleView}>
                {viewing === 'origin' ? 'See the other side' : 'Back to my digger'}
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Pick another spot
              </button>
            </div>
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
