import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TOPICS, type LatLon, type Place, type Topic, type TopicCard } from '../../shared/types';
import { findCard } from '../lib/cards';
import { EARTH_DIAMETER_KM, formatCoords } from '../lib/geo';
import { useLocalClock } from '../lib/useLocalClock';

interface Props {
  exit: LatLon;
  /** What is at the far end, or null when only the coordinates are known. */
  place: Place | null;
  /** Cards already written for this trip; the place's overview supplies the facts. */
  cards: readonly TopicCard[];
  /** Stack the captions in a column instead of spreading them over the photo. */
  compact: boolean;
  onShowOnGlobe: () => void;
  onDigElsewhere: () => void;
}

const TOPIC_LABEL: Record<Topic, string> = {
  food: 'Food',
  culture: 'Culture',
  history: 'History',
  nature: 'Nature',
  language: 'Language',
};

const isTopic = (value: string): value is Topic => (TOPICS as readonly string[]).includes(value);

/**
 * Where each fact sits on a wide screen, in percent of the view: the numbered
 * marker on the photo, the caption plate, and which top corner of the plate
 * the leader line runs to.
 */
const CALLOUTS = [
  { marker: { x: 60, y: 42 }, plate: { x: 70, y: 19, width: 24 }, corner: 'left' },
  { marker: { x: 62, y: 67 }, plate: { x: 71, y: 52, width: 23 }, corner: 'left' },
  { marker: { x: 37, y: 63 }, plate: { x: 5.5, y: 69, width: 23 }, corner: 'right' },
] as const;

/**
 * The arrival: the destination's photo fills the screen and the page is laid
 * over it like a spread in an illustrated encyclopedia. The photo file itself
 * is never altered; everything here is drawn on top of it.
 */
export default function SurfaceView({ exit, place, cards, compact, onShowOnGlobe, onDigElsewhere }: Props) {
  const view = useRef<HTMLElement>(null);
  useEffect(() => {
    view.current?.focus({ preventScroll: true });
  }, []);

  // Remember which URL failed rather than a flag, so a new place gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = place?.photoUrl && failedUrl !== place.photoUrl ? place.photoUrl : null;

  const overview = place ? findCard(cards, place.name, []) : undefined;
  const facts = (overview?.facts ?? []).slice(0, CALLOUTS.length);

  // Open water has no food or language to explore, so it offers only what its overview lists.
  const topics: readonly Topic[] = !place
    ? []
    : place.isOcean
      ? (overview?.subtopics.filter(isTopic) ?? ['nature'])
      : TOPICS;

  const [openTopic, setOpenTopic] = useState<Topic | null>(null);
  useEffect(() => {
    if (!openTopic) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenTopic(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openTopic]);
  const openCard = place && openTopic ? findCard(cards, place.name, [openTopic]) : undefined;

  const clock = useLocalClock(place);
  const coords = formatCoords(exit);
  const title = place?.name ?? coords;
  const classes = ['surface', compact && 'surface--compact', !photo && 'surface--plain'].filter(Boolean).join(' ');

  return (
    <section
      className={classes}
      ref={view}
      tabIndex={-1}
      aria-labelledby="surface-title"
      // The name is sized to fit: the longer it is, the smaller it is set.
      style={{ '--name-length': Math.max(title.length, 4) } as CSSProperties}
    >
      {photo && (
        <div className="surface__backdrop">
          <img className="surface__photo" src={photo} alt="" onError={() => setFailedUrl(photo)} />
          <div className="surface__scrim" />
        </div>
      )}

      <div className="surface__actions">
        <button type="button" className="btn" onClick={onShowOnGlobe}>
          See it on the globe
        </button>
        <button type="button" className="btn" onClick={onDigElsewhere}>
          Dig somewhere else
        </button>
      </div>

      <div className="surface__lead">
        <p className="surface__eyebrow">{place ? 'You surfaced in' : 'You surfaced at'}</p>
        <h2 id="surface-title" className="surface__name">
          {title}
        </h2>
        {place && <p className="surface__where">{place.isOcean ? 'Open ocean' : place.country}</p>}

        <dl className="placards">
          <div className="placard">
            <dt>Distance travelled</dt>
            <dd>{EARTH_DIAMETER_KM.toLocaleString('en-US')} km</dd>
          </div>
          {clock && (
            <div className="placard">
              <dt>Local time</dt>
              <dd>{clock}</dd>
            </div>
          )}
          {place && (
            <div className="placard">
              <dt>Coordinates</dt>
              <dd>{coords}</dd>
            </div>
          )}
        </dl>

        {!place && (
          <p className="surface__note">
            Names, photos and facts for the far side arrive with live data in phase 3. The sample digs show a complete
            arrival.
          </p>
        )}
      </div>

      {facts.length > 0 && !compact && (
        <svg className="surface__leaders" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {facts.map((fact, i) => {
            const { marker, plate, corner } = CALLOUTS[i];
            const end = corner === 'left' ? plate.x : plate.x + plate.width;
            const line = { x1: marker.x, y1: marker.y, x2: end, y2: plate.y };
            return (
              <g key={fact}>
                <line className="surface__leader surface__leader--edge" {...line} />
                <line className="surface__leader" {...line} />
              </g>
            );
          })}
        </svg>
      )}

      {facts.length > 0 && (
        <ol className="surface__facts">
          {facts.map((fact, i) => {
            const { marker, plate } = CALLOUTS[i];
            return (
              <li key={fact} className="fact">
                <span className="fact__marker" style={compact ? undefined : { left: `${marker.x}%`, top: `${marker.y}%` }}>
                  {i + 1}
                </span>
                <p
                  className="fact__plate"
                  style={compact ? undefined : { left: `${plate.x}%`, top: `${plate.y}%`, width: `${plate.width}%` }}
                >
                  {fact}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {place && photo && (
        <p className="surface__credit">
          {place.photoPageUrl ? (
            <a href={place.photoPageUrl} target="_blank" rel="noreferrer">
              {place.photoCredit}
            </a>
          ) : (
            place.photoCredit
          )}
        </p>
      )}

      {place && openTopic && (
        <aside className={`topic-plate topic-plate--${openTopic}`} aria-label={`${TOPIC_LABEL[openTopic]} card`}>
          <button type="button" className="btn btn--small topic-plate__close" onClick={() => setOpenTopic(null)}>
            Close
          </button>
          <p className="eyebrow">{TOPIC_LABEL[openTopic]}</p>
          {openCard ? (
            <>
              <h3 className="topic-plate__title">{openCard.title}</h3>
              <p className="topic-plate__hook">{openCard.hook}</p>
              <ol className="facts">
                {openCard.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ol>
              <p className="topic-plate__next">Dig deeper: {openCard.subtopics.join(' · ')}</p>
            </>
          ) : (
            <p className="topic-plate__hook">
              Cards about {TOPIC_LABEL[openTopic].toLowerCase()} in {place.name} are written by the AI, which arrives
              in phase 4.
            </p>
          )}
        </aside>
      )}

      {topics.length > 0 && (
        <nav className="tabs" aria-label="Dig deeper">
          <span className="tabs__label">Dig deeper</span>
          {topics.map((topic) => (
            <button
              key={topic}
              type="button"
              className={`tab tab--${topic}`}
              aria-expanded={openTopic === topic}
              onClick={() => setOpenTopic(openTopic === topic ? null : topic)}
            >
              {TOPIC_LABEL[topic]}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}
