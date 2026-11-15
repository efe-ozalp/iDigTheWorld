import { useEffect, useState, type CSSProperties } from 'react';
import { MAX_TOPIC_DEPTH, type Place, type Topic, type TopicCard } from '../../shared/types';
import { getCard, type CardResult } from '../lib/ai';
import type { DailyDig } from '../data/dailyDigs';
import { findCard } from '../lib/cards';
import StickerFind from './StickerFind';

interface Props {
  place: Place;
  /** The topic whose object was clicked: the top of the trail. */
  topic: Topic;
  /** The topic's display name, e.g. "Biosphere". */
  topicName: string;
  /** Encyclopedia text about the place, which the cards are written from. */
  grounding: string;
  /** Cards already written for this place; these are shown without asking the model. */
  prepared: readonly TopicCard[];
  /** Where the card sits on a wide screen. */
  position?: CSSProperties;
  /** Set when this is the day's place and topic: its bedrock card carries the sticker. */
  sticker?: DailyDig;
  onClose: () => void;
}

/**
 * The card a topic object opens, and every card below it. Each card offers two
 * or three narrower things to dig into; choosing one opens the next card down.
 * The fifth card is bedrock: there is nothing further to dig.
 */
export default function TopicCards({ place, topic, topicName, grounding, prepared, position, sticker, onClose }: Props) {
  const [trail, setTrail] = useState<string[]>([topic]);
  const depth = trail.length;

  // The card for the current trail. Keyed by the trail, so a late answer for an
  // earlier card can never be shown under a newer one.
  const trailKey = trail.join(' > ');
  const [loaded, setLoaded] = useState<{ key: string; result: CardResult } | null>(null);
  const ready = findCard(prepared, place.name, trail);
  useEffect(() => {
    if (ready) return;
    let current = true;
    void getCard(place, trail, grounding).then((result) => {
      if (current) setLoaded({ key: trailKey, result });
    });
    return () => {
      current = false;
    };
    // The trail's contents are captured by trailKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, trailKey, grounding, ready]);

  const result: CardResult | null = ready ? { kind: 'card', card: ready } : loaded?.key === trailKey ? loaded.result : null;

  return (
    <aside className={`topic-plate topic-plate--${topic}`} style={position} aria-label={`${topicName} card`}>
      <div className="topic-plate__bar">
        <p className="eyebrow">
          {topicName} · layer {depth} of {MAX_TOPIC_DEPTH}
        </p>
        <div className="topic-plate__buttons">
          {depth > 1 && (
            <button type="button" className="btn btn--small" onClick={() => setTrail(trail.slice(0, -1))}>
              Back up
            </button>
          )}
          <button type="button" className="btn btn--small" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {depth > 1 && <p className="topic-plate__trail">{trail.slice(1).join(' › ')}</p>}

      <div aria-live="polite">
        {result === null ? (
          <p className="topic-plate__hook topic-plate__digging">Digging…</p>
        ) : result.kind === 'card' ? (
          <>
            <h3 className="topic-plate__title">{result.card.title}</h3>
            <p className="topic-plate__hook">{result.card.hook}</p>
            <ol className="facts">
              {result.card.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ol>

            {depth >= MAX_TOPIC_DEPTH || result.card.subtopics.length === 0 ? (
              <>
                {sticker && <StickerFind dig={sticker} />}
                <div className="topic-plate__bedrock">
                  <p>
                    <strong>You’ve hit bedrock.</strong> This is as deep as the digging goes here.
                  </p>
                  <button type="button" className="btn btn--small" onClick={() => setTrail([topic])}>
                    Back to the top
                  </button>
                </div>
              </>
            ) : (
              <div className="topic-plate__deeper">
                <p className="topic-plate__next">Dig deeper:</p>
                {result.card.subtopics.map((subtopic) => (
                  <button key={subtopic} type="button" className="btn btn--small" onClick={() => setTrail([...trail, subtopic])}>
                    {subtopic}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="topic-plate__hook">{result.text}</p>
            <p className="topic-plate__next">
              The guide could not be reached, so this is the encyclopedia entry for {place.name}. Close the card and
              open it again to retry.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
