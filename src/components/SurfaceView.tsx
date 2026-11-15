import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TOPICS, type LatLon, type Place, type Topic, type TopicCard } from '../../shared/types';
import { TOPIC_OBJECTS, topicObjectImage } from '../data/topicObjects';
import { prefetchCards } from '../lib/ai';
import { findCard } from '../lib/cards';
import { buildFieldNotes } from '../lib/fieldNotes';
import { formatCoords } from '../lib/geo';
import { useLocalClock } from '../lib/useLocalClock';
import Burst from './Burst';
import FieldNotes from './FieldNotes';
import TopicCards from './TopicCards';
import TopicObject from './TopicObject';

interface Props {
  /**
   * 'arrival' is where the tunnel comes out. 'origin' is the starting point,
   * shown the same way before the dig, with a Dig! button in place of the
   * way back to the globe.
   */
  variant: 'arrival' | 'origin';
  /** The spot this page is about. */
  exit: LatLon;
  /** What is there, or null when only the coordinates are known. */
  place: Place | null;
  /** Short facts about the place, used unless a written overview card supplies its own. */
  facts: readonly string[];
  /** Encyclopedia text about the place, which the AI cards are written from. */
  grounding: string;
  /** Cards already written for this trip. */
  cards: readonly TopicCard[];
  /** Phone layout: a field-notes button and a row of small object icons. */
  compact: boolean;
  /** Arrival: turn the globe to this spot. Origin: start digging. */
  onPrimary: () => void;
  /** Back to the globe to choose a different spot. */
  onDigElsewhere: () => void;
  /** Offered on an ocean arrival: head for the nearest coast. */
  onSwim?: () => void;
  /** True while the nearest coast is being found. */
  swimming?: boolean;
  /** Set once the swim is done: how far it was. */
  swamKm?: number;
  /** True for the moment after the dig is triggered: the page lifts away and soil or spray flies up. */
  leaving?: boolean;
}

const isTopic = (value: string): value is Topic => (TOPICS as readonly string[]).includes(value);

/**
 * The arrival. The destination's photo fills the screen, with the place name
 * at the top left, the field notes rolled up in a scroll at the left edge, and
 * one cut-out object per topic scattered over the picture. The photo file
 * itself is never altered; everything here is drawn on top of it.
 */
export default function SurfaceView({
  variant,
  exit,
  place,
  facts,
  grounding,
  cards,
  compact,
  onPrimary,
  onDigElsewhere,
  onSwim,
  swimming = false,
  swamKm,
  leaving = false,
}: Props) {
  const isOrigin = variant === 'origin';
  const view = useRef<HTMLElement>(null);
  useEffect(() => {
    view.current?.focus({ preventScroll: true });
  }, []);

  // Remember which URL failed rather than a flag, so a new place gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = place?.photoUrl && failedUrl !== place.photoUrl ? place.photoUrl : null;

  const overview = place ? findCard(cards, place.name, []) : undefined;
  const notes = buildFieldNotes({
    travelled: !isOrigin,
    swamKm,
    exit,
    place,
    facts: overview?.facts ?? facts,
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

  // Start writing each topic's opening card now, so it is ready when its object is clicked.
  const topicList = topics.join(',');
  useEffect(() => {
    if (!place || !topicList) return;
    const unwritten = topicList.split(',').filter((topic) => !findCard(cards, place.name, [topic]));
    prefetchCards(place, unwritten, grounding);
  }, [place, topicList, grounding, cards]);

  const title = place?.name ?? formatCoords(exit);
  // An arrival by tunnel comes up through the ground; a swim ashore just appears.
  const emerging = !isOrigin && swamKm === undefined;
  const ground = place?.isOcean ? 'water' : 'dirt';
  const classes = [
    'surface',
    compact && 'surface--compact',
    !photo && 'surface--plain',
    leaving && 'surface--leaving',
    emerging && 'surface--emerging',
  ]
    .filter(Boolean)
    .join(' ');

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
        {onSwim && place?.isOcean && (
          <button type="button" className="btn btn--primary" onClick={onSwim} disabled={swimming}>
            {swimming ? 'Swimming…' : 'Swim to nearest coast'}
          </button>
        )}
        <button type="button" className={isOrigin ? 'btn btn--primary' : 'btn'} onClick={onPrimary}>
          {isOrigin ? 'Dig!' : 'See it on the globe'}
        </button>
        <button type="button" className="btn" onClick={onDigElsewhere}>
          {isOrigin ? 'Pick another spot' : 'Dig somewhere else'}
        </button>
      </div>

      <div className="surface__lead">
        <p className="surface__eyebrow">
          {isOrigin
            ? place
              ? 'You are in'
              : 'You are at'
            : swamKm !== undefined
              ? 'You swam ashore in'
              : place
                ? 'You surfaced in'
                : 'You surfaced at'}
        </p>
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

      {isOrigin && !compact && <p className="surface__flick">Throw your cursor hard at the bottom edge to dig</p>}
      {leaving && <Burst kind={ground} />}
      {emerging && <Burst kind={ground} settle />}

      {place && openTopic && (
        <TopicCards
          // A fresh trail for each object.
          key={openTopic}
          place={place}
          topic={openTopic}
          topicName={TOPIC_OBJECTS[openTopic].name}
          grounding={grounding}
          prepared={cards}
          position={compact ? undefined : TOPIC_OBJECTS[openTopic].cardPosition}
          onClose={() => setOpenTopic(null)}
        />
      )}
    </section>
  );
}
