import type { CSSProperties } from 'react';
import type { Topic } from '../../shared/types';

/**
 * The cut-out objects that stand for the topics on the surface view.
 *
 * The images are the team's own PNGs in /public/objects, with transparent
 * backgrounds. They are used exactly as supplied: never edit the files.
 */

export interface TopicObject {
  /** Name shown to screen readers and on the fallback button. */
  name: string;
  /** The handwritten label beside the object. */
  label: string;
  /** The picture for a place on land. */
  image: string;
  /** The picture for open water, for the topics that apply there. */
  oceanImage?: string;
  /** Where the object sits on a wide screen, in percent of the view and vw. */
  position: CSSProperties;
  /** A casual tilt, in degrees. */
  tilt: number;
  /** Where the label hangs, relative to the object's own box. */
  labelPosition: CSSProperties;
  /** Where the topic's card opens, next to the object. */
  cardPosition: CSSProperties;
}

declare const __BUILD_ID__: string;

/**
 * The pictures keep their file names when they are replaced, so each address
 * carries the build's ID. A browser that saved the old picture sees a new
 * address after a deploy and fetches the new one.
 */
const object = (file: string) => `/objects/${file}?v=${__BUILD_ID__}`;

export const TOPIC_OBJECTS: Record<Topic, TopicObject> = {
  // Top centre, clear of the place name on its left.
  biosphere: {
    name: 'Biosphere',
    label: 'biosphere',
    image: object('land-biosphere.png'),
    oceanImage: object('water-biosphere.png'),
    position: { left: '48%', top: '6%', width: '19vw' },
    tilt: -3,
    labelPosition: { right: '12%', bottom: '-3%' },
    cardPosition: { left: '36%', top: '31%' },
  },
  // Top right, under the two buttons.
  cuisine: {
    name: 'Cuisine',
    label: 'cuisine',
    image: object('cuisine.png'),
    position: { left: '78.5%', top: '13%', width: '12.5vw' },
    tilt: 6,
    labelPosition: { left: '-4%', bottom: '10%' },
    cardPosition: { right: '23.5%', top: '29%' },
  },
  // Middle of the right-hand side.
  history: {
    name: 'History',
    label: 'history',
    image: object('history.png'),
    position: { left: '79.5%', top: '48%', width: '15vw' },
    tilt: -5,
    labelPosition: { left: '6%', bottom: '-1%' },
    cardPosition: { right: '22.5%', top: '30%' },
  },
  // Lower centre right.
  culture: {
    name: 'Culture',
    label: 'culture',
    image: object('culture.png'),
    position: { left: '49%', bottom: '7%', width: '14vw' },
    tilt: 3,
    labelPosition: { right: '-12%', top: '26%' },
    cardPosition: { left: '36%', bottom: '32%' },
  },
};

/** Picks the picture for a topic, depending on whether the place is land or water. */
export function topicObjectImage(topic: Topic, isOcean: boolean): string {
  const object = TOPIC_OBJECTS[topic];
  return (isOcean && object.oceanImage) || object.image;
}

/**
 * Starts downloading every object picture. Called when a dig begins, so they
 * are ready by the time the explorer surfaces.
 */
export function preloadTopicObjects(): void {
  for (const { image, oceanImage } of Object.values(TOPIC_OBJECTS)) {
    for (const url of [image, oceanImage]) {
      if (url) new Image().src = url;
    }
  }
}
