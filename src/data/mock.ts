import { TOPICS, type Dig, type LatLon, type Place, type TopicCard } from '../../shared/types';
import { antipode } from '../lib/geo';
import { localTimeIn } from '../lib/time';

/**
 * Hand-written sample digs: one that surfaces on land and one in open ocean.
 * They stand in for live data until geocoding and the AI cards exist, and are
 * meant to become two of the offline "Featured digs" later on.
 *
 * Summaries and facts are condensed from the lead sections of the matching
 * English Wikipedia articles. Photos are bundled in /public/photos and are all
 * public domain or CC0.
 */

type PlaceDetails = Omit<Place, 'lat' | 'lon' | 'localTime' | 'timeZone'>;

function place(at: LatLon, timeZone: string, details: PlaceDetails): Place {
  return { ...at, ...details, timeZone, localTime: localTimeIn(timeZone) ?? '' };
}

type CardBody = Pick<TopicCard, 'title' | 'hook' | 'facts' | 'subtopics'>;

function card(placeName: string, topicPath: string[], body: CardBody): TopicCard {
  return { id: [placeName, ...topicPath].join('/').toLowerCase(), placeName, topicPath, ...body };
}

// Puerta del Sol, the traditional centre of Madrid.
const MADRID: LatLon = { lat: 40.4169, lon: -3.7033 };

const MADRID_TO_WEBER: Dig = {
  id: 'madrid-weber',
  origin: place(MADRID, 'Europe/Madrid', {
    name: 'Madrid',
    country: 'Spain',
    isOcean: false,
    summary:
      'Madrid is the capital and largest city of Spain. It lies on the River Manzanares in the centre of the Iberian Peninsula, about 660 metres above sea level, and is the political, economic and cultural centre of the country.',
    photoUrl: '/photos/madrid.jpg',
    photoCredit: 'The Madrid skyline. Photo: Zarateman, CC0, via Wikimedia Commons.',
    photoPageUrl:
      'https://commons.wikimedia.org/wiki/File:Madrid_-_Sky_Bar_360%C2%BA_(Hotel_Riu_Plaza_Espa%C3%B1a),_vistas_19.jpg',
  }),
  destination: place(antipode(MADRID), 'Pacific/Auckland', {
    name: 'Weber',
    country: 'New Zealand',
    isOcean: false,
    summary:
      'Weber is a village 28 km south-east of Dannevirke and 23 km west-northwest of Herbertville, on the east coast of New Zealand’s North Island. It is named after the German-born surveyor Charles H. Weber.',
    photoUrl: '/photos/waihi-falls.jpg',
    photoCredit: 'Waihi Falls, in the hills near Weber. Photo: Pseudopanax, public domain, via Wikimedia Commons.',
    photoPageUrl: 'https://commons.wikimedia.org/wiki/File:Waihi_Falls_from_lookout.jpg',
  }),
  cards: [
    card('Madrid', [], {
      title: 'Madrid',
      hook: 'Spain’s capital stands some 660 metres above the sea, in the very middle of the Iberian Peninsula.',
      facts: [
        'Madrid is the capital and largest city of Spain, home to more than 3.4 million people.',
        'It lies on the River Manzanares, about 660 metres above sea level.',
        'Only Berlin is a bigger city in the European Union.',
      ],
      subtopics: [...TOPICS],
    }),
    card('Weber', [], {
      title: 'Weber, New Zealand',
      hook: 'Tunnel straight down from the middle of Madrid and you pop out beside a small village on New Zealand’s North Island.',
      facts: [
        'Weber is a village 28 km south-east of the town of Dannevirke.',
        'It is named after Charles H. Weber, a German-born surveyor who died on a surveying project in 1886.',
        'Madrid and Weber are near-perfect antipodes: the two ends of a line through the centre of the Earth.',
      ],
      subtopics: [...TOPICS],
    }),
    card('Weber', ['nature'], {
      title: 'A world turned upside down',
      hook: 'Standing in Weber, almost everything about the sky and the seasons runs opposite to Madrid.',
      facts: [
        'Waihi Falls, a broad curtain of water spilling over a rock ledge, lies in the hill country near Weber.',
        'New Zealand is in the Southern Hemisphere, so midsummer here falls in December and January.',
        'Antipodes are twelve hours apart by the Sun: when it is noon in one, it is midnight in the other.',
      ],
      subtopics: ['Waihi Falls', 'Seasons in reverse', 'Day and night'],
    }),
    card('Weber', ['nature', 'Seasons in reverse'], {
      title: 'Seasons in reverse',
      hook: 'When Madrid is wrapped up for winter, Weber is in the middle of summer.',
      facts: [
        'The Earth’s axis is tilted by about 23.4°, so the two hemispheres take turns leaning toward the Sun.',
        'December brings the longest days of the year to New Zealand and the shortest to Spain.',
        'At antipodes the seasons are always exactly opposite: spring on one side is autumn on the other.',
      ],
      subtopics: ['The tilt of the Earth', 'Solstices'],
    }),
  ],
};

// The Wisconsin State Capitol.
const MADISON: LatLon = { lat: 43.0747, lon: -89.3842 };

const MADISON_TO_INDIAN_OCEAN: Dig = {
  id: 'madison-indian-ocean',
  origin: place(MADISON, 'America/Chicago', {
    name: 'Madison',
    country: 'United States',
    isOcean: false,
    summary:
      'Madison is the capital of the U.S. state of Wisconsin and its second-most populous city. Its downtown sits on an isthmus between Lakes Mendota and Monona. Founded in 1836, it is named after President James Madison.',
    photoUrl: '/photos/madison.jpg',
    photoCredit: 'Downtown Madison on its isthmus. Photo: Wikideas1, CC0, via Wikimedia Commons.',
    photoPageUrl: 'https://commons.wikimedia.org/wiki/File:Madison,_Wisconsin_skyline.jpg',
  }),
  // The open sea has no civil time zone. Ships keep nautical time, one hour per
  // 15° of longitude, which puts 90.6° E at UTC+6. IANA spells that
  // "Etc/GMT-6": the sign in these zone names is inverted.
  destination: place(antipode(MADISON), 'Etc/GMT-6', {
    name: 'Indian Ocean',
    country: '',
    isOcean: true,
    oceanName: 'Indian Ocean',
    summary:
      'The Indian Ocean is the third-largest of the world’s five oceanic divisions, covering about 20% of the water on Earth’s surface. It is bounded by Asia to the north, Africa to the west and Australia to the east.',
    photoUrl: '/photos/indian-ocean.jpg',
    photoCredit:
      'The Indian Ocean seen from the International Space Station. Photo: NASA, public domain, via Wikimedia Commons.',
    photoPageUrl: 'https://commons.wikimedia.org/wiki/File:ISS006-E-44031_-_View_of_the_Indian_Ocean.jpg',
  }),
  cards: [
    card('Madison', [], {
      title: 'Madison, Wisconsin',
      hook: 'Wisconsin’s capital is squeezed onto a strip of land between two lakes.',
      facts: [
        'Madison is the capital of the U.S. state of Wisconsin and its second-most populous city.',
        'Its downtown sits on an isthmus between Lakes Mendota and Monona.',
        'Founded in 1836, the city is named after President James Madison.',
      ],
      subtopics: [...TOPICS],
    }),
    card('Indian Ocean', [], {
      title: 'The Indian Ocean',
      hook: 'Dig down from Madison and you come up for air in open water, far from any shore.',
      facts: [
        'The Indian Ocean is the third-largest of the world’s five oceans.',
        'It covers about 70.5 million km², roughly a fifth of all the ocean surface on Earth.',
        'It is bounded by Asia to the north, Africa to the west and Australia to the east.',
      ],
      subtopics: ['nature'],
    }),
    card('Indian Ocean', ['nature'], {
      title: 'Life in the open ocean',
      hook: 'There is no land in sight, but these southern waters are far from empty.',
      facts: [
        'Southern bluefin tuna roam the open waters of the Southern Hemisphere, mainly between 30° S and 50° S.',
        'They can grow to 2.5 metres long and weigh as much as 260 kilograms.',
        'Overhead, wandering albatrosses circle the whole Southern Ocean. They are the largest of all the albatrosses.',
      ],
      subtopics: ['Southern bluefin tuna', 'Wandering albatross'],
    }),
  ],
};

export const MOCK_DIGS: Dig[] = [MADRID_TO_WEBER, MADISON_TO_INDIAN_OCEAN];
