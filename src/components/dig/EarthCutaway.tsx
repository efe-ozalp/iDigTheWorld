import { memo } from 'react';
import { DIGGER_FIGURE, FLAG } from '../../art/sprites';
import { LAYERS, type Layer, type LayerId } from '../../data/layers';

/**
 * The cutaway diagram: the Earth sliced through its centre, the tunnel down
 * the middle, and a leader line from each layer out to its caption.
 *
 * Everything is drawn in the units below. DigScene lays its HTML captions out
 * with the same numbers, which is how the leader lines meet them.
 */
export const VIEW = { width: 1000, height: 640 };
export const GLOBE = { cx: 290, cy: 322, r: 240 };

/** Left edge of the caption column, and the height of each layer's caption. */
export const LABEL_X = 600;
export const CALLOUT_Y: Record<LayerId, number> = {
  crust: 188,
  mantle: 292,
  'outer-core': 396,
  'inner-core': 500,
};

export const LAYER_COLOR: Record<LayerId, string> = {
  crust: '#a9825a',
  mantle: '#e2622b',
  'outer-core': '#f59e1c',
  'inner-core': '#ffd95a',
};

const TEXTURE: Partial<Record<LayerId, string>> = {
  crust: 'url(#tex-strata)',
  mantle: 'url(#tex-rock)',
  'outer-core': 'url(#tex-liquid)',
};

/** Where each leader line touches its layer: degrees clockwise from east, and a share of the radius. */
const ANCHOR: Record<LayerId, { angle: number; radius: number }> = {
  crust: { angle: -52, radius: 0.965 },
  mantle: { angle: -22, radius: 0.74 },
  'outer-core': { angle: 18, radius: 0.37 },
  'inner-core': { angle: 50, radius: 0.1 },
};

const ELBOW_X = 566;
const INK = '#3d2a17';

/** A layer is a ring; SVG draws one as a circle with a very thick outline. */
function ring(layer: Layer) {
  const outer = layer.drawTop * GLOBE.r;
  const inner = layer.drawBottom * GLOBE.r;
  return { cx: GLOBE.cx, cy: GLOBE.cy, r: (outer + inner) / 2, strokeWidth: outer - inner, fill: 'none' };
}

/** The parts that never change during a dig. */
const Base = memo(function Base() {
  const { cx, cy, r } = GLOBE;
  return (
    <>
      <defs>
        <pattern id="tex-strata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(40,20,0,.32)" strokeWidth="1.2" />
        </pattern>
        <pattern id="tex-rock" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.1" fill="rgba(90,20,0,.26)" />
          <circle cx="10.5" cy="10.5" r="1.1" fill="rgba(90,20,0,.26)" />
        </pattern>
        <pattern id="tex-liquid" width="26" height="11" patternUnits="userSpaceOnUse">
          <path d="M0 5.5q6.5-5 13 0t13 0" fill="none" stroke="rgba(140,60,0,.34)" strokeWidth="1.3" />
        </pattern>
      </defs>

      {LAYERS.map((layer) => (
        <g key={layer.id}>
          <circle {...ring(layer)} stroke={LAYER_COLOR[layer.id]} />
          {TEXTURE[layer.id] && <circle {...ring(layer)} stroke={TEXTURE[layer.id]} />}
        </g>
      ))}

      {/* Boundaries between layers, then the surface. */}
      {LAYERS.slice(1).map((layer) => (
        <circle key={layer.id} cx={cx} cy={cy} r={layer.drawTop * r} fill="none" stroke={INK} strokeWidth="1.2" />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={INK} strokeWidth="2.6" />

      {/* The planned route, and the hole where the dig begins. */}
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={INK} strokeWidth="1.4" strokeDasharray="2 7" strokeLinecap="round" />
      <ellipse cx={cx} cy={cy - r} rx="11" ry="3.6" fill={INK} />
    </>
  );
});

function Leader({ layer, lit }: { layer: Layer; lit: boolean }) {
  const { angle, radius } = ANCHOR[layer.id];
  const radians = (angle * Math.PI) / 180;
  const x = GLOBE.cx + GLOBE.r * radius * Math.cos(radians);
  const y = GLOBE.cy + GLOBE.r * radius * Math.sin(radians);
  const rowY = CALLOUT_Y[layer.id];
  return (
    <g className={lit ? 'cutaway__leader is-lit' : 'cutaway__leader'}>
      <polyline points={`${x},${y} ${ELBOW_X},${rowY} ${LABEL_X - 8},${rowY}`} />
      <circle cx={x} cy={y} r="3.2" />
    </g>
  );
}

interface Props {
  /** Where the digger is: -1 at the starting surface, 0 at the centre, 1 at the exit. */
  position: number;
  /** How far the digger has turned over, in degrees: 0 heading down, 180 once it is climbing. */
  turn: number;
  /** A small rocking motion while digging, in degrees. */
  wobble: number;
  /** How many layers have been uncovered so far. */
  reached: number;
  arrived: boolean;
  /** Draw the leader lines out to the captions. Off when the captions are not beside the diagram. */
  leaders: boolean;
  /** Narrow screens crop the drawing to the globe alone. */
  compact: boolean;
  startLabel: string;
  exitLabel: string;
}

export default function EarthCutaway({
  position,
  turn,
  wobble,
  reached,
  arrived,
  leaders,
  compact,
  startLabel,
  exitLabel,
}: Props) {
  const { cx, cy, r } = GLOBE;
  const y = cy + position * r;

  return (
    <svg
      className="cutaway"
      viewBox={compact ? `30 0 520 ${VIEW.height}` : `0 0 ${VIEW.width} ${VIEW.height}`}
      role="img"
      aria-label="Cross-section of the Earth showing the crust, mantle, outer core and inner core, with a tunnel running straight through the centre."
    >
      <Base />

      {/* Layers the digger has not reached yet are washed out; each clears as it arrives. */}
      {LAYERS.map((layer) => (
        <circle
          key={layer.id}
          {...ring(layer)}
          className="cutaway__veil"
          style={{ opacity: layer.number <= reached ? 0 : 0.62 }}
        />
      ))}

      {/* The tunnel dug so far. */}
      <line className="cutaway__bore" x1={cx} y1={cy - r} x2={cx} y2={y} />

      {leaders && LAYERS.map((layer) => <Leader key={layer.id} layer={layer} lit={layer.number <= reached} />)}

      <text className="cutaway__label" x={cx} y="26" textAnchor="middle">
        START
      </text>
      <text className="cutaway__sublabel" x={cx} y="45" textAnchor="middle">
        {startLabel}
      </text>
      <text className="cutaway__label" x={cx} y="608" textAnchor="middle">
        EXIT
      </text>
      <text className="cutaway__sublabel" x={cx} y="628" textAnchor="middle">
        {exitLabel}
      </text>
      {!compact && (
        <text className="cutaway__note" x="20" y="628">
          Crust not drawn to scale
        </text>
      )}

      {/* The far side's flag. It is flipped top to bottom, because over there "up" points this way. */}
      {arrived && (
        <g
          transform={`translate(${cx + 42} ${cy + r}) scale(0.8 -0.8) translate(-9 -53)`}
          dangerouslySetInnerHTML={{ __html: FLAG }}
        />
      )}

      <g className="cutaway__digger" transform={`translate(${cx} ${y})`}>
        <circle className="cutaway__lamp" r="25" />
        <g
          transform={`rotate(${turn + wobble}) scale(0.72) translate(-24 -34)`}
          dangerouslySetInnerHTML={{ __html: DIGGER_FIGURE }}
        />
      </g>
    </svg>
  );
}
