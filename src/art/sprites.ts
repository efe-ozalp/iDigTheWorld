/**
 * Small drawings shared by the globe markers and the dig diagram.
 *
 * They are raw SVG markup, not components, because the globe library builds
 * its markers outside React. Each string is the contents of an <svg> or <g>.
 */

/** Ground shadow for the digger, in the same 48 by 64 box as the figure. */
export const DIGGER_SHADOW = `<ellipse cx="24" cy="60" rx="15" ry="3.6" fill="rgba(0,0,0,.3)"/>`;

/** The digger: 48 by 64, feet on the ground at (24, 60), body centred near (24, 34). */
export const DIGGER_FIGURE = `
  <rect x="36.9" y="17" width="2.8" height="38" rx="1.4" fill="#8a5a2b"/>
  <rect x="34.6" y="14.6" width="7.4" height="3.4" rx="1.7" fill="#8a5a2b"/>
  <path d="M33.4 50h9.8v5.5q-4.9 7-9.8 0z" fill="#aab3bd" stroke="#59616a" stroke-width="1"/>
  <rect x="16.5" y="41" width="6.2" height="17" rx="2.5" fill="#2f4a7a"/>
  <rect x="24.6" y="41" width="6.2" height="17" rx="2.5" fill="#2f4a7a"/>
  <rect x="14.2" y="55" width="9" height="5.2" rx="2.2" fill="#3a2a1c"/>
  <rect x="24.4" y="55" width="9" height="5.2" rx="2.2" fill="#3a2a1c"/>
  <rect x="14" y="24" width="19.5" height="21" rx="6" fill="#d2342a"/>
  <path d="M30.5 29.5 38.2 33" stroke="#d2342a" stroke-width="5.2" stroke-linecap="round"/>
  <circle cx="38.3" cy="33.2" r="2.7" fill="#f2c9a0"/>
  <path d="M16.2 29.5 11.6 38" stroke="#d2342a" stroke-width="5.2" stroke-linecap="round"/>
  <circle cx="11.4" cy="38.6" r="2.7" fill="#f2c9a0"/>
  <circle cx="23.7" cy="16.2" r="8" fill="#f2c9a0"/>
  <path d="M14.6 14.4a9.1 9.1 0 0 1 18.2 0z" fill="#f5b700"/>
  <rect x="12.4" y="13.4" width="22.6" height="2.8" rx="1.4" fill="#dba300"/>
  <circle cx="20.9" cy="18.6" r="1" fill="#3a2a1c"/>
  <circle cx="26.5" cy="18.6" r="1" fill="#3a2a1c"/>
  <path d="M21.1 21.4q2.6 1.9 5.2 0" fill="none" stroke="#3a2a1c" stroke-width="1" stroke-linecap="round"/>`;

/** The exit flag: 40 by 56, foot of the pole at (9, 53). */
export const FLAG = `
  <ellipse cx="9" cy="52.6" rx="8" ry="2.6" fill="rgba(0,0,0,.3)"/>
  <rect x="7.6" y="4" width="2.8" height="49" rx="1.4" fill="#6b4a2a"/>
  <path d="M10.4 6.2 36 14.2 10.4 23z" fill="#f5b700" stroke="#a87c00" stroke-width="1" stroke-linejoin="round"/>
  <circle cx="9" cy="4" r="2.7" fill="#d2342a"/>`;
