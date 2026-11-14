/**
 * The Earth's four main layers and the timetable of a dig through them.
 *
 * Depths follow the standard reference model of the Earth's interior.
 * Temperatures are textbook approximations: estimates for the deep Earth vary
 * by hundreds of degrees, so the app always presents them as "about".
 */

export const EARTH_RADIUS_KM = 6371;

export type LayerId = 'crust' | 'mantle' | 'outer-core' | 'inner-core';

export interface Layer {
  id: LayerId;
  /** The callout number printed on the diagram. */
  number: number;
  name: string;
  /** What the layer is made of, in a few words. */
  state: string;
  /** One line worth remembering. */
  fact: string;
  /** Depth below the surface of the layer's upper and lower boundaries, in km. */
  topKm: number;
  bottomKm: number;
  /** Approximate temperature at those boundaries, in degrees Celsius. */
  topC: number;
  bottomC: number;
  /**
   * Where the boundaries are drawn, as a fraction of the diagram's radius
   * (1 is the surface, 0 the centre). True to scale except for the crust,
   * which would be a hairline and is drawn about twelve times too thick.
   */
  drawTop: number;
  drawBottom: number;
  /** Seconds the dig spends in the layer on the way down, and on the way back up. */
  downSeconds: number;
  upSeconds: number;
}

export const LAYERS: readonly Layer[] = [
  {
    id: 'crust',
    number: 1,
    name: 'Crust',
    state: 'solid rock',
    fact: 'Earth’s rocky skin. For its size, it is thinner than the peel on an apple.',
    topKm: 0,
    bottomKm: 35,
    topC: 15,
    bottomC: 800,
    drawTop: 1,
    drawBottom: 0.93,
    downSeconds: 1.1,
    upSeconds: 0.8,
  },
  {
    id: 'mantle',
    number: 2,
    name: 'Mantle',
    state: 'hot rock that slowly flows',
    fact: 'Solid rock that creeps like very thick toffee. It makes up about 84% of the planet’s volume.',
    topKm: 35,
    bottomKm: 2890,
    topC: 800,
    bottomC: 3700,
    drawTop: 0.93,
    drawBottom: 0.546,
    downSeconds: 1.7,
    upSeconds: 1.2,
  },
  {
    id: 'outer-core',
    number: 3,
    name: 'Outer core',
    state: 'liquid iron and nickel',
    fact: 'A swirling ocean of liquid metal. Its motion creates Earth’s magnetic field.',
    topKm: 2890,
    bottomKm: 5150,
    topC: 3700,
    bottomC: 5000,
    drawTop: 0.546,
    drawBottom: 0.19,
    downSeconds: 1.4,
    upSeconds: 1.0,
  },
  {
    id: 'inner-core',
    number: 4,
    name: 'Inner core',
    state: 'solid iron and nickel',
    fact: 'A solid metal ball about as hot as the surface of the Sun. At its centre, every direction is up.',
    topKm: 5150,
    bottomKm: EARTH_RADIUS_KM,
    topC: 5000,
    bottomC: 5400,
    drawTop: 0.19,
    drawBottom: 0,
    downSeconds: 1.0,
    upSeconds: 0.8,
  },
];

/** One stretch of the dig: a single layer, crossed in one direction. */
export interface Leg {
  layer: Layer;
  /** False on the way down to the centre, true on the way back up. */
  ascending: boolean;
  /** Seconds from the start of the dig. */
  start: number;
  end: number;
}

function buildLegs(): Leg[] {
  const legs: Leg[] = [];
  let clock = 0;
  const add = (layer: Layer, ascending: boolean) => {
    const start = clock;
    clock += ascending ? layer.upSeconds : layer.downSeconds;
    legs.push({ layer, ascending, start, end: clock });
  };
  for (const layer of LAYERS) add(layer, false);
  for (const layer of [...LAYERS].reverse()) add(layer, true);
  return legs;
}

/** Down through all four layers, then back up through them in reverse. */
export const LEGS: readonly Leg[] = buildLegs();

/** How long the whole dig takes. */
export const DIG_SECONDS = LEGS[LEGS.length - 1].end;

/** Where the explorer is, and what the instruments read, at one moment of the dig. */
export interface JourneyPoint {
  legIndex: number;
  layer: Layer;
  ascending: boolean;
  /** Distance below the nearer surface, in km. */
  depthKm: number;
  /** Distance travelled along the tunnel so far, in km. */
  dugKm: number;
  temperatureC: number;
  /** Position on the diagram: -1 at the starting surface, 0 at the centre, 1 at the exit. */
  position: number;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

export function journeyAt(seconds: number): JourneyPoint {
  const t = Math.min(Math.max(seconds, 0), DIG_SECONDS);
  const found = LEGS.findIndex((leg) => t < leg.end);
  const legIndex = found === -1 ? LEGS.length - 1 : found;
  const { layer, ascending, start, end } = LEGS[legIndex];

  // How far through the layer, measured from its upper boundary (0) to its lower one (1).
  const along = (t - start) / (end - start);
  const down = ascending ? 1 - along : along;

  const depthKm = lerp(layer.topKm, layer.bottomKm, down);
  const drawn = lerp(layer.drawTop, layer.drawBottom, down);

  return {
    legIndex,
    layer,
    ascending,
    depthKm,
    dugKm: ascending ? 2 * EARTH_RADIUS_KM - depthKm : depthKm,
    temperatureC: lerp(layer.topC, layer.bottomC, down),
    position: ascending ? drawn : -drawn,
  };
}
