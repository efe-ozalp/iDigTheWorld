import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TOPICS, type LatLon, type Place, type Topic, type TopicCard } from '../../shared/types';
import { TOPIC_OBJECTS, topicObjectImage } from '../data/topicObjects';
import { findCard } from '../lib/cards';
import { buildFieldNotes } from '../lib/fieldNotes';
import { formatCoords } from '../lib/geo';
import { useLocalClock } from '../lib/useLocalClock';
import FieldNotes from './FieldNotes';
import TopicObject from './TopicObject';

interface Props {
  exit: LatLon;
  /** What is at the far end, or null when only the coordinates are known. */
  place: Place | null;
  /** Cards already written for this trip; the place's overview supplies the facts. */
  cards: readonly TopicCard[];
  /** Phone layout: a field-notes button and a row of small object icons. */
  compact: boolean;
  onShowOnGlobe: () => void;
  onDigElsewhere: () => void;
}

const isTopic = (value: string): value is Topic => (TOPICS as readonly string[]).includes(value);

/**
 * The arrival. The destination's photo fills the screen, with the place name
 * at the top left, the field notes rolled up in a scroll at the left edge, and
 * one cut-out object per topic scattered over the picture. The photo file
 * itself is never altered; everything here is drawn on top of it.
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
  const notes = buildFieldNotes({
    exit,
    place,
    facts: overview?.facts ?? [],
    localTime: useLocalClock(place),
  });

  // Land offers all four topics. Open water has no cuisine, culture or history, only its biosphere.
  const topics: readonly Topic[] = !place
    ? []
    : place.isOcean
      ? (overview?.subtopics.filter(isTopic) ?? ['biosphere'])
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

  const title = place?.name ?? formatCoords(exit);
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
      </div>

      <FieldNotes sections={notes} compact={compact} />

      {place && topics.length > 0 && (
        <div className="objects">
          {topics.map((topic) => (
            <TopicObject
              key={topic}
              object={TOPIC_OBJECTS[topic]}
              image={topicObjectImage(topic, place.isOcean)}
              open={openTopic === topic}
              compact={compact}
              onToggle={() => setOpenTopic(openTopic === topic ? null : topic)}
            />
          ))}
        </div>
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
        <aside
          className={`topic-plate topic-plate--${openTopic}`}
          style={compact ? undefined : TOPIC_OBJECTS[openTopic].cardPosition}
          aria-label={`${TOPIC_OBJECTS[openTopic].name} card`}
        >
          <button type="button" className="btn btn--small topic-plate__close" onClick={() => setOpenTopic(null)}>
            Close
          </button>
          <p className="eyebrow">{TOPIC_OBJECTS[openTopic].name}</p>
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
              Cards about {TOPIC_OBJECTS[openTopic].label} in {place.name} are written by the AI, which arrives in
              phase 4.
            </p>
          )}
        </aside>
      )}
    </section>
  );
}
