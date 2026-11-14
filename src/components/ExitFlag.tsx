/**
 * The yellow flag that marks where the tunnel comes out.
 *
 * Drawn in a box 40 wide and 56 tall, with the foot of the pole at (9, 53).
 * Like Explorer, it renders an SVG group and can be swapped for a photograph later.
 */
export default function ExitFlag() {
  return (
    <g>
      <ellipse cx="9" cy="52.6" rx="8" ry="2.6" fill="rgba(0,0,0,.3)" />
      <rect x="7.6" y="4" width="2.8" height="49" rx="1.4" fill="#6b4a2a" />
      <path d="M10.4 6.2 36 14.2 10.4 23z" fill="#f5b700" stroke="#a87c00" strokeWidth="1" strokeLinejoin="round" />
      <circle cx="9" cy="4" r="2.7" fill="#d2342a" />
    </g>
  );
}
