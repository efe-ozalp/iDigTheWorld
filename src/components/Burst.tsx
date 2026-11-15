import type { CSSProperties } from 'react';

interface Props {
  /** Soil for land, spray for open water. */
  kind: 'dirt' | 'water';
  /** Played backwards and more gently, for an arrival: the bits settle instead of flying. */
  settle?: boolean;
}

/** A steady stand-in for randomness, so the same bit always gets the same path. */
const scatter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * A burst of soil or spray thrown up from the bottom of the screen as the
 * digging starts. Purely decorative, and switched off under reduced motion.
 */
export default function Burst({ kind, settle = false }: Props) {
  const count = settle ? 16 : 34;
  return (
    <div className={`burst burst--${kind}${settle ? ' burst--settle' : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          style={
            {
              '--x': `${18 + scatter(i, 1) * 64}%`,
              '--rise': `${28 + scatter(i, 2) * 52}vh`,
              '--drift': `${(scatter(i, 3) - 0.5) * 34}vw`,
              '--size': `${7 + scatter(i, 4) * 17}px`,
              '--spin': `${(scatter(i, 5) - 0.5) * 720}deg`,
              '--delay': `${scatter(i, 6) * 0.22}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
