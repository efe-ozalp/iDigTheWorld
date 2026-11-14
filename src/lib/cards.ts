import type { TopicCard } from '../../shared/types';

/**
 * The card written for a place and a trail of topics, if there is one.
 * An empty trail asks for the place's overview card.
 */
export function findCard(
  cards: readonly TopicCard[],
  placeName: string,
  topicPath: readonly string[],
): TopicCard | undefined {
  return cards.find(
    (card) =>
      card.placeName === placeName &&
      card.topicPath.length === topicPath.length &&
      card.topicPath.every((topic, i) => topic === topicPath[i]),
  );
}
