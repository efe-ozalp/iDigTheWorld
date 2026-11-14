import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dig, LatLon } from '../shared/types';
import DigPanel, { type Side } from './components/DigPanel';
import ErrorBoundary from './components/ErrorBoundary';
import GlobeView, { type GlobeViewHandle } from './components/GlobeView';
import SurfaceView from './components/SurfaceView';
import DigScene from './components/dig/DigScene';
import { MOCK_DIGS } from './data/mock';
import { preloadTopicObjects } from './data/topicObjects';
import { findCard } from './lib/cards';
import { loadDestination, type DestinationState } from './lib/destination';
import { antipode } from './lib/geo';
import { lookupPlace, type PlaceLookup } from './lib/place';
import { useDigTriggers } from './lib/useDigTriggers';
import { useMediaQuery } from './lib/useMediaQuery';

interface Selection {
  origin: LatLon;
  /** Set when the pin came from a prepared dig; null for a free click on the globe. */
  dig: Dig | null;
}

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
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

  // The origin card is open whenever a spot is picked. While it is, the globe
  // stops turning so that a downward flick anywhere can start the dig.
  const cardOpen = selection !== null && !digging;
  const surfaced = digging && reachedSurface && destination.status === 'ready';

  const dropPin = useCallback((point: LatLon) => {
    setSelection({ origin: point, dig: null });
    setViewing('origin');
  }, []);

  const pickSample = useCallback((dig: Dig) => {
    setSelection({ origin: { lat: dig.origin.lat, lon: dig.origin.lon }, dig });
    setViewing('origin');
  }, []);

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

  /** Back to the globe, turned to show where the tunnel came out. */
  const showExitOnGlobe = useCallback(() => {
    endDig();
    setViewing('exit');
    if (exit) globeRef.current?.flyTo(exit, 1800);
  }, [endDig, exit]);

  /** Closes the origin card, which also frees the globe to turn again. */
  const clearSelection = useCallback(() => {
    endDig();
    setSelection(null);
    setViewing('origin');
  }, [endDig]);

  const markSurfaceReached = useCallback(() => setReachedSurface(true), []);

  useDigTriggers(cardOpen, startDig);

  return (
    <div className={cardOpen ? 'app app--armed' : 'app'}>
      <header className="masthead">
        <h1 className="wordmark">
          <i>i</i>DigTheWorld
        </h1>
        <p className="strapline">Dig a hole. See where you come out.</p>
      </header>

      <main className="stage">
        <div className="stage__globe" inert={digging}>
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
              locked={cardOpen}
              paused={digging}
              onPick={dropPin}
            />
            <p className="hint">
              {cardOpen
                ? 'Flick down, press ↓ or hit Dig! to tunnel through'
                : 'Click anywhere on the globe to set down your explorer'}
            </p>
          </ErrorBoundary>
        </div>

        <DigPanel
          origin={origin}
          exit={exit}
          originInfo={originInfo}
          originLoading={origin !== null && !originKnown}
          activeSampleId={sample?.id ?? null}
          sampleDigs={MOCK_DIGS}
          viewing={viewing}
          hidden={digging}
          onDig={startDig}
          onPickSample={pickSample}
          onToggleView={toggleView}
          onClose={clearSelection}
        />

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
            exit={exit}
            place={destination.status === 'ready' ? (destination.found?.place ?? null) : null}
            facts={destination.status === 'ready' ? (destination.found?.facts ?? []) : []}
            cards={sample?.cards ?? []}
            compact={compact}
            onShowOnGlobe={showExitOnGlobe}
            onDigElsewhere={clearSelection}
          />
        )}
      </main>
    </div>
  );
}
