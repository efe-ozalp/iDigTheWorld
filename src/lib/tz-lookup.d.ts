declare module 'tz-lookup' {
  /** The IANA time zone at a coordinate, e.g. "Pacific/Auckland". Throws on invalid input. */
  export default function tzlookup(lat: number, lon: number): string;
}
