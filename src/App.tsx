import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dig, LatLon } from '../shared/types';
import DigPanel, { type Side } from './components/DigPanel';
import ErrorBoundary from './components/ErrorBoundary';
import GlobeView, { APPROACH_MS, type GlobeViewHandle } from './components/GlobeView';
import SurfaceView from './components/SurfaceView';
import DigScene from './components/dig/DigScene';
import { MOCK_DIGS } from './data/mock';
import { preloadTopicObjects } from './data/topicObjects';
import { findCard } from './lib/cards';
import { nearestCoasts } from './lib/coast';
import { loadDestination, type DestinationState } from './lib/destination';
import { antipode, formatCoords } from './lib/geo';
import { lookupPlace, type PlaceLookup } from './lib/place';
import { useCursorFlick } from './lib/useCursorFlick';
import { useDigTriggers } from './lib/useDigTriggers';
import { useMediaQuery } from './lib/useMediaQuery';

interface Selection {
  origin: LatLon;
  /** Set when the pin came from a prepared dig; null for a free click on the globe. */
  dig: Dig | null;
}

/**
 * What the picked spot is showing:
 *   approach  the globe is zooming in while the spot is looked up
 *   page      the spot's own full-screen page, from which the dig starts
 *   review    back on the globe after a dig, with both ends marked
 */
type OriginView = 'approach' | 'page' | 'review';

/** A prepared dig's starting point, in the same shape a live lookup gives. */
function sampleOrigin(dig: Dig): PlaceLookup {
  const facts = [...(findCard(dig.cards, dig.origin.name, [])?.facts ?? [])];
  return { place: dig.origin, facts, grounding: [dig.origin.summary, ...facts].join(' ') };
}

/** How long the starting page takes to lift away before the dig begins. Matches surface-leave in app.css. */
const LEAVE_MS = 900;

/** Never hold the zoomed-in globe longer than this waiting for a slow lookup. */
const APPROACH_LIMIT_MS = 8000;

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [originView, setOriginView] = useState<OriginView>('approach');
  const [viewing, setViewing] = useState<Side>('origin');

  // A dig in progress: the animation and the destination lookup run side by side.
  const [digging, setDigging] = useState(false);
  const [reachedSurface, setReachedSurface] = useState(false);
  const [destination, setDestination] = useState<DestinationState>({ status: 'idle' });
  /** Numbers each dig, so a lookup that finishes late cannot land on a newer one. */
  const digRun = useRef(0);
  // After surfacing at sea: the swim to the nearest coast, which then takes over the arrival page.
  const [swimming, setSwimming] = useState(false);
  const [swam, setSwam] = useState<{ to: LatLon; km: number } | null>(null);
  // The moment between triggering a dig and the dig itself, while the page lifts away.
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const globeRef = useRef<GlobeViewHandle>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const compact = useMediaQuery('(max-width: 820px)');

  const origin = selection?.origin ?? null;
  const exit = useMemo(() => (origin ? antipode(origin) : null), [origin]);

  // A spot picked by hand is looked up as soon as the pin lands. Prepared digs carry their own data.
  const [looked, setLooked] = useState<{ at: LatLon; found: PlaceLookup | null } | null>(null);
  useEffect(() => {
    if (!selection || selection.dig) return;
    let current = true;
    void lookupPlace(selection.origin).then((found) => {
      if (current) setLooked({ at: selection.origin, found });
    });
    return () => {
      current = false;
    };
  }, [selection]);

  const sample = selection?.dig ?? null;
  const originKnown = sample !== null || looked?.at === origin;
  const originInfo: PlaceLookup | null = sample
    ? sampleOrigin(sample)
    : looked?.at === origin
      ? looked.found
      : null;

  // The approach: the globe zooms in for a few seconds, then the spot's page
  // opens once the lookup is in too (or after a limit, with whatever is known).
  const [zoomDone, setZoomDone] = useState(false);
  const [waitedEnough, setWaitedEnough] = useState(false);
  useEffect(() => {
    if (!selection) return;
    const zoom = setTimeout(() => setZoomDone(true), reducedMotion ? 400 : APPROACH_MS);
    const limit = setTimeout(() => setWaitedEnough(true), APPROACH_LIMIT_MS);
    return () => {
      clearTimeout(zoom);
      clearTimeout(limit);
    };
  }, [selection, reducedMotion]);

  const select = useCallback((next: Selection) => {
    setSelection(next);
    setOriginView('approach');
    setZoomDone(false);
    setWaitedEnough(false);
    setViewing('origin');
  }, []);

  const dropPin = useCallback((point: LatLon) => select({ origin: point, dig: null }), [select]);
  const pickSample = useCallback(
    (dig: Dig) => select({ origin: { lat: dig.origin.lat, lon: dig.origin.lon }, dig }),
    [select],
  );

  const approaching = selection !== null && originView === 'approach' && !(zoomDone && (originKnown || waitedEnough));
  const onOriginPage = selection !== null && !digging && originView !== 'review' && !approaching;
  const reviewing = selection !== null && !digging && originView === 'review';
  const surfaced = digging && reachedSurface && destination.status === 'ready';

  const toggleView = useCallback(() => {
    if (!origin || !exit) return;
    const next: Side = viewing === 'origin' ? 'exit' : 'origin';
    setViewing(next);
    globeRef.current?.flyTo(next === 'exit' ? exit : origin, 1800);
  }, [origin, exit, viewing]);

  const startDig = useCallback(() => {
    if (!selection || !exit || digging || leaving) return;
    const run = ++digRun.current;
    setReachedSurface(false);
    setSwam(null);
    setDestination({ status: 'loading' });
    // From the spot's own page, break ground first: the page lifts away for a moment.
    if (onOriginPage && !reducedMotion) {
      setLeaving(true);
      leaveTimer.current = setTimeout(() => {
        setLeaving(false);
        setDigging(true);
      }, LEAVE_MS);
    } else {
      setDigging(true);
    }
    // Start the lookup and the picture downloads now, so the animation covers the wait.
    preloadTopicObjects();
    void loadDestination(exit, selection.dig).then((found) => {
      if (digRun.current === run) setDestination({ status: 'ready', found });
    });
  }, [selection, exit, digging, leaving, onOriginPage, reducedMotion]);

  const endDig = useCallback(() => {
    digRun.current += 1;
    clearTimeout(leaveTimer.current);
    setLeaving(false);
    setDigging(false);
    setReachedSurface(false);
    setSwimming(false);
    setDestination({ status: 'idle' });
  }, []);

  /** From an ocean arrival, finds the nearest coast that has a name and opens its page. */
  const swimToCoast = useCallback(async () => {
    if (!exit || swimming) return;
    const run = digRun.current;
    setSwimming(true);
    const coasts = await nearestCoasts(exit);
    let landed: { to: LatLon; km: number; found: PlaceLookup | null } | null = null;
    for (const coast of coasts) {
      const found = await lookupPlace(coast.point);
      // Keep the nearest stretch as a fallback, but prefer the first that turns out to be named land.
      landed ??= { to: coast.point, km: coast.km, found };
      if (found && !found.place.isOcean) {
        landed = { to: coast.point, km: coast.km, found };
        break;
      }
    }
    if (digRun.current !== run) return;
    setSwimming(false);
    if (landed) {
      setSwam({ to: landed.to, km: landed.km });
      setDestination({ status: 'ready', found: landed.found });
    }
  }, [exit, swimming]);

  /** Back to the globe, pulled out and turned to show where the tunnel came out. */
  const showExitOnGlobe = useCallback(() => {
    endDig();
    setOriginView('review');
    setViewing('exit');
    const spot = swam?.to ?? exit;
    if (spot) globeRef.current?.flyTo(spot, 1800, 2);
  }, [endDig, exit, swam]);

  /** Drops the picked spot, which also frees the globe to turn again. */
  const clearSelection = useCallback(() => {
    endDig();
    setSelection(null);
    setViewing('origin');
  }, [endDig]);

  const markSurfaceReached = useCallback(() => setReachedSurface(true), []);

  // Ways to start the dig: the down-arrow key or a press-and-drag flick (also
  // the touch gesture) wherever a spot is ready, and on the spot's own page a
  // fast downward throw of the cursor with no button held.
  useDigTriggers(onOriginPage || reviewing, startDig);
  useCursorFlick(onOriginPage, startDig);

  const covered = digging || onOriginPage;

  return (
    <div className={reviewing ? 'app app--armed' : 'app'}>
      <header className="masthead">
        <h1 className="wordmark">
          <i>i</i>DigTheWorld
        </h1>
        <p className="strapline">Dig a hole. See where you come out.</p>
      </header>

      <main className="stage">
        <div className="stage__globe" inert={covered}>
          {/* The globe needs WebGL. Without it, say so and leave the sample digs usable. */}
          <ErrorBoundary
            fallback={
              <div className="globe-fallback">
                <p className="globe-fallback__title">The 3D globe could not start in this browser.</p>
                <p>You can still explore the sample digs.</p>
              </div>
            }
          >
            <GlobeView
              ref={globeRef}
              origin={origin}
              exit={exit}
              locked={approaching || reviewing}
              paused={covered}
              onPick={dropPin}
            />
            <p className="hint" role="status">
              {approaching && origin
                ? `Zooming in on ${formatCoords(origin)}…`
                : reviewing
                  ? 'Flick down, press ↓ or hit Dig! to tunnel through'
                  : 'Click anywhere on the globe to set down your explorer'}
            </p>
          </ErrorBoundary>
        </div>

        <DigPanel
          origin={reviewing ? origin : null}
          exit={reviewing ? exit : null}
          originInfo={originInfo}
          originLoading={false}
          approaching={approaching ? origin : null}
          activeSampleId={sample?.id ?? null}
          sampleDigs={MOCK_DIGS}
          viewing={viewing}
          hidden={covered}
          onDig={startDig}
          onPickSample={pickSample}
          onToggleView={toggleView}
          onClose={clearSelection}
        />

        {/* Plain paper behind a page that is lifting away or coming up, so the globe never shows through. */}
        {(leaving || surfaced) && <div className="ground" />}

        {onOriginPage && origin && (
          <SurfaceView
            variant="origin"
            leaving={leaving}
            exit={origin}
            place={originInfo?.place ?? null}
            facts={originInfo?.facts ?? []}
            grounding={originInfo?.grounding ?? ''}
            cards={sample?.cards ?? []}
            compact={compact}
            onPrimary={startDig}
            onDigElsewhere={clearSelection}
          />
        )}

        {digging && !surfaced && origin && exit && (
          <DigScene
            origin={origin}
            exit={exit}
            originName={originInfo?.place.name}
            destination={destination}
            reducedMotion={reducedMotion}
            compact={compact}
            onReachSurface={markSurfaceReached}
          />
        )}

        {surfaced && exit && (
          <SurfaceView
            // A fresh page for the coast, so it makes its own entrance.
            key={swam ? 'coast' : 'exit'}
            variant="arrival"
            exit={swam?.to ?? exit}
            onSwim={swam ? undefined : swimToCoast}
            swimming={swimming}
            swamKm={swam?.km}
            place={destination.status === 'ready' ? (destination.found?.place ?? null) : null}
            facts={destination.status === 'ready' ? (destination.found?.facts ?? []) : []}
            grounding={destination.status === 'ready' ? (destination.found?.grounding ?? '') : ''}
            cards={sample?.cards ?? []}
            compact={compact}
            onPrimary={showExitOnGlobe}
            onDigElsewhere={clearSelection}
          />
        )}
      </main>
    </div>
  );
}
