interface Props {
  /** Draw the soft shadow on the ground under the feet. Leave it off inside a diagram. */
  shadow?: boolean;
}

/**
 * The explorer: the little figure who stands on the globe and does the digging.
 *
 * Drawn in a box 48 wide and 64 tall, standing on the ground at (24, 60) with
 * the body centred near (24, 34). It renders an SVG group, so it goes inside
 * an <svg> or another drawing. It is its own component so the drawing can be
 * swapped for a cut-out photograph later without touching the screens that use it.
 */
export default function Explorer({ shadow = false }: Props) {
  return (
    <g>
      {shadow && <ellipse cx="24" cy="60" rx="15" ry="3.6" fill="rgba(0,0,0,.3)" />}

      {/* Shovel, held in the right hand */}
      <rect x="36.9" y="17" width="2.8" height="38" rx="1.4" fill="#8a5a2b" />
      <rect x="34.6" y="14.6" width="7.4" height="3.4" rx="1.7" fill="#8a5a2b" />
      <path d="M33.4 50h9.8v5.5q-4.9 7-9.8 0z" fill="#aab3bd" stroke="#59616a" strokeWidth="1" />

      {/* Legs and boots */}
      <rect x="16.5" y="41" width="6.2" height="17" rx="2.5" fill="#2f4a7a" />
      <rect x="24.6" y="41" width="6.2" height="17" rx="2.5" fill="#2f4a7a" />
      <rect x="14.2" y="55" width="9" height="5.2" rx="2.2" fill="#3a2a1c" />
      <rect x="24.4" y="55" width="9" height="5.2" rx="2.2" fill="#3a2a1c" />

      {/* Jacket, arms and hands */}
      <rect x="14" y="24" width="19.5" height="21" rx="6" fill="#d2342a" />
      <path d="M30.5 29.5 38.2 33" stroke="#d2342a" strokeWidth="5.2" strokeLinecap="round" />
      <circle cx="38.3" cy="33.2" r="2.7" fill="#f2c9a0" />
      <path d="M16.2 29.5 11.6 38" stroke="#d2342a" strokeWidth="5.2" strokeLinecap="round" />
      <circle cx="11.4" cy="38.6" r="2.7" fill="#f2c9a0" />

      {/* Head, hard hat and face */}
      <circle cx="23.7" cy="16.2" r="8" fill="#f2c9a0" />
      <path d="M14.6 14.4a9.1 9.1 0 0 1 18.2 0z" fill="#f5b700" />
      <rect x="12.4" y="13.4" width="22.6" height="2.8" rx="1.4" fill="#dba300" />
      <circle cx="20.9" cy="18.6" r="1" fill="#3a2a1c" />
      <circle cx="26.5" cy="18.6" r="1" fill="#3a2a1c" />
      <path d="M21.1 21.4q2.6 1.9 5.2 0" fill="none" stroke="#3a2a1c" strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}
