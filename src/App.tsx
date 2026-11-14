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
    ? { place: sample.origin, facts: [...(findCard(sample.cards, sample.origin.name, [])?.facts ?? [])] }
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

  const approaching = selection !== null && originView === 'approach' && !(zoomDone && (originKnown || waitedEnough));
  const onOriginPage = selection !== null && !digging && originView !== 'review' && !approaching;
  const reviewing = selection !== null && !digging && originView === 'review';
  const surfaced = digging && reachedSurface && destination.status === 'ready';

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

  const toggleView = useCallback(() => {
    if (!origin || !exit) return;
    const next: Side = viewing === 'origin' ? 'exit' : 'origin';
    setViewing(next);
    globeRef.current?.flyTo(next === 'exit' ? exit : origin, 1800);
  }, [origin, exit, viewing]);

  const startDig = useCallback(() => {
    if (!selection || !exit || digging) return;
    const run = ++digRun.current;
    setDigging(true);
    setReachedSurface(false);
    setDestination({ status: 'loading' });
    // Start the lookup and the picture downloads now, so the animation covers the wait.
    preloadTopicObjects();
    void loadDestination(exit, selection.dig).then((found) => {
      if (digRun.current === run) setDestination({ status: 'ready', found });
    });
  }, [selection, exit, digging]);

  const endDig = useCallback(() => {
    digRun.current += 1;
    setDigging(false);
    setReachedSurface(false);
    setDestination({ status: 'idle' });
  }, []);

  /** Back to the globe, pulled out and turned to show where the tunnel came out. */
  const showExitOnGlobe = useCallback(() => {
    endDig();
    setOriginView('review');
    setViewing('exit');
    if (exit) globeRef.current?.flyTo(exit, 1800, 2);
  }, [endDig, exit]);

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

        {onOriginPage && origin && (
          <SurfaceView
            variant="origin"
            exit={origin}
            place={originInfo?.place ?? null}
            facts={originInfo?.facts ?? []}
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
            variant="arrival"
            exit={exit}
            place={destination.status === 'ready' ? (destination.found?.place ?? null) : null}
            facts={destination.status === 'ready' ? (destination.found?.facts ?? []) : []}
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
