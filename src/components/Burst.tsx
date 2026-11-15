import type { CSSProperties } from 'react';

declare const __BUILD_ID__: string;

interface Props {
  /** Soil for land, droplets for open water. */
  kind: 'dirt' | 'water';
}

/** A steady stand-in for randomness, so the same bit always gets the same path. */
const scatter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The team's own pictures in /public/particles, used exactly as supplied.
 * A clod picture is a whole spray of soil, so a few go a long way; the droplet
 * picture is one small drop, so there are many more of them.
 */
const BITS = {
  dirt: { count: 9, smallest: 150, largest: 320 },
  water: { count: 36, smallest: 18, largest: 50 },
} as const;

/**
 * Soil or water thrown up from the bottom of the screen, both when a dig
 * starts and when the explorer comes up at the far end. Purely decorative,
 * and switched off under reduced motion.
 */
export default function Burst({ kind }: Props) {
  const { count, smallest, largest } = BITS[kind];
  return (
    <div
      className={`burst burst--${kind}`}
      style={{ '--sprite': `url(/particles/${kind}.png?v=${__BUILD_ID__})` } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={
            {
              '--x': `${14 + scatter(i, 1) * 70}%`,
              '--rise': `${28 + scatter(i, 2) * 52}vh`,
              '--drift': `${(scatter(i, 3) - 0.5) * 34}vw`,
              '--size': `${smallest + scatter(i, 4) * (largest - smallest)}px`,
              '--spin': `${(scatter(i, 5) - 0.5) * (kind === 'dirt' ? 260 : 60)}deg`,
              '--delay': `${scatter(i, 6) * 0.22}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
