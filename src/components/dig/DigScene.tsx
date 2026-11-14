import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LatLon } from '../../../shared/types';
import { DIG_SECONDS, EARTH_RADIUS_KM, LAYERS, LEGS, journeyAt, type JourneyPoint } from '../../data/layers';
import type { DestinationState } from '../../lib/destination';
import { formatCoords } from '../../lib/geo';
import EarthCutaway, { CALLOUT_Y, LABEL_X, LAYER_COLOR, VIEW } from './EarthCutaway';

interface Props {
  origin: LatLon;
  exit: LatLon;
  /** Name of the starting place, when it is known. */
  originName?: string;
  destination: DestinationState;
  /** Run the shorter, stepped version for people who prefer less motion. */
  reducedMotion: boolean;
  /** Stack the diagram above its captions, for narrow screens. */
  compact: boolean;
  /** Called once, a moment after the animation reaches the far surface. */
  onReachSurface: () => void;
}

const TUNNEL_KM = 2 * EARTH_RADIUS_KM;

/** In the reduced-motion version the digger jumps from layer to layer at this pace. */
const STEP_SECONDS = 0.5;

/** How long the finished diagram stays up before the arrival takes over the screen. */
const ARRIVAL_PAUSE_MS = 700;

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Places an HTML block on the diagram using the SVG's own coordinates. */
function at(x: number, y: number, width: number): CSSProperties {
  return {
    left: `${(x / VIEW.width) * 100}%`,
    top: `${(y / VIEW.height) * 100}%`,
    width: `${(width / VIEW.width) * 100}%`,
  };
}

const smoothstep = (from: number, to: number, x: number) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The reduced-motion dig: the digger sits in the middle of one layer at a time. */
function steppedPoint(elapsed: number): JourneyPoint {
  const leg = LEGS[Math.min(Math.floor(elapsed / STEP_SECONDS), LEGS.length - 1)];
  return journeyAt((leg.start + leg.end) / 2);
}

/** Runs a clock from zero to `seconds`, once, and reports when it gets there. */
function useDigClock(seconds: number, onDone: () => void) {
  const [elapsed, setElapsed] = useState(0);
  const [skipped, setSkipped] = useState(false);

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const reported = useRef(false);

  useEffect(() => {
    let frame = 0;
    let pause: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      setElapsed(seconds);
      pause = setTimeout(() => {
        if (reported.current) return;
        reported.current = true;
        onDoneRef.current();
      }, ARRIVAL_PAUSE_MS);
    };

    if (skipped) {
      finish();
    } else {
      let startedAt: number | null = null;
      const tick = (now: number) => {
        startedAt ??= now;
        const t = (now - startedAt) / 1000;
        if (t >= seconds) {
          finish();
          return;
        }
        setElapsed(t);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(pause);
    };
  }, [seconds, skipped]);

  const skip = useCallback(() => setSkipped(true), []);
  return { elapsed, finished: elapsed >= seconds, skip };
}

/** The animated cross-section shown while the digger tunnels through the Earth. */
export default function DigScene({
  origin,
  exit,
  originName,
  destination,
  reducedMotion,
  compact,
  onReachSurface,
}: Props) {
  const { elapsed, finished, skip } = useDigClock(reducedMotion ? LEGS.length * STEP_SECONDS : DIG_SECONDS, onReachSurface);

  const point = finished ? journeyAt(DIG_SECONDS) : reducedMotion ? steppedPoint(elapsed) : journeyAt(elapsed);
  const reached = point.ascending ? LAYERS.length : point.layer.number;

  // Past the centre "down" becomes "up", so the digger turns over and climbs.
  const turn = reducedMotion ? (point.position > 0 ? 180 : 0) : 180 * smoothstep(-0.15, 0.15, point.position);
  const wobble = finished || reducedMotion ? 0 : Math.sin(elapsed * Math.PI * 6) * 7;

  const located = destination.status === 'ready';
  const status = finished
    ? located
      ? 'You are through!'
      : 'Breaking through the surface…'
    : located
      ? 'Exit located. Hold on!'
      : 'Looking up where you will come out…';

  // Move keyboard focus off the hidden globe and onto the scene.
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    root.current?.focus();
  }, []);

  const startCoords = formatCoords(origin);
  const exitCoords = formatCoords(exit);
  const place = (block: CSSProperties) => (compact ? undefined : block);

  return (
    <section
      className={compact ? 'dig dig--compact' : 'dig'}
      ref={root}
      tabIndex={-1}
      aria-label="Digging through the Earth"
      style={{ '--view-w': VIEW.width, '--view-h': VIEW.height } as CSSProperties}
    >
      <div className="dig__spread">
        <EarthCutaway
          position={point.position}
          turn={turn}
          wobble={wobble}
          reached={reached}
          arrived={finished}
          leaders={!compact}
          compact={compact}
          startLabel={originName ? `${originName} · ${startCoords}` : startCoords}
          exitLabel={exitCoords}
        />

        <header className="dig__block dig__heading" style={place(at(LABEL_X, 12, 385))}>
          <p className="dig__eyebrow">Cross-section</p>
          <h2 className="dig__title">Straight through the Earth</h2>
        </header>

        {/* The numbers change every frame, so keep them out of screen readers' way;
            the layer announcements below carry the story instead. */}
        <div className="dig__block readout" style={place(at(LABEL_X, 70, 385))} aria-hidden="true">
          <div className="readout__cell">
            <span className="readout__label">Depth</span>
            <span className="readout__value">
              {whole.format(point.depthKm)} <small>km</small>
            </span>
          </div>
          <div className="readout__cell">
            <span className="readout__label">Temperature, about</span>
            <span className="readout__value">
              {whole.format(Math.round(point.temperatureC / 10) * 10)} <small>°C</small>
            </span>
          </div>
          <div className="readout__track">
            <span className="readout__fill" style={{ width: `${(point.dugKm / TUNNEL_KM) * 100}%` }} />
          </div>
          <p className="readout__dug">
            {whole.format(point.dugKm)} of {whole.format(TUNNEL_KM)} km dug
          </p>
        </div>

        <ol className="callouts">
          {LAYERS.map((layer) => {
            const state = layer.number > reached ? 'is-ahead' : layer.number === point.layer.number ? 'is-here' : 'is-seen';
            return (
              <li
                key={layer.id}
                className={`dig__block callouts__item ${state}`}
                style={{ ...place(at(LABEL_X, CALLOUT_Y[layer.id] - 14, 385)), '--layer': LAYER_COLOR[layer.id] } as CSSProperties}
              >
                <span className="callouts__number">{layer.number}</span>
                <div>
                  <h3 className="callouts__name">
                    {layer.name} <span className="callouts__state">{layer.state}</span>
                  </h3>
                  <p className="callouts__range">
                    {whole.format(layer.topKm)}–{whole.format(layer.bottomKm)} km deep · about {whole.format(layer.topC)}–
                    {whole.format(layer.bottomC)} °C
                  </p>
                  <p className="callouts__fact">{layer.fact}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="dig__block dig__status" style={place(at(LABEL_X, 590, 385))}>
          <p role="status">{status}</p>
          {!finished && (
            <button type="button" className="btn btn--small" onClick={skip}>
              Skip
            </button>
          )}
        </div>

        <p className="visually-hidden" aria-live="polite">
          {point.ascending ? 'Climbing back up through the' : 'Now in the'} {point.layer.name.toLowerCase()}.{' '}
          {point.ascending ? '' : point.layer.fact}
        </p>
      </div>
    </section>
  );
}
