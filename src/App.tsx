import { useCallback, useMemo, useRef, useState } from 'react';
import type { Dig, LatLon } from '../shared/types';
import DigPanel, { type Side } from './components/DigPanel';
import ErrorBoundary from './components/ErrorBoundary';
import GlobeView, { type GlobeViewHandle } from './components/GlobeView';
import { MOCK_DIGS } from './data/mock';
import { antipode } from './lib/geo';

interface Selection {
  origin: LatLon;
  /** Set when the pin came from a prepared dig; null for a free click on the globe. */
  dig: Dig | null;
}

export default function App() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [viewing, setViewing] = useState<Side>('origin');
  const globeRef = useRef<GlobeViewHandle>(null);

  const origin = selection?.origin ?? null;
  const exit = useMemo(() => (origin ? antipode(origin) : null), [origin]);

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

  const reset = useCallback(() => {
    setSelection(null);
    setViewing('origin');
  }, []);

  return (
    <div className="app">
      <header className="masthead">
        <h1 className="wordmark">
          <i>i</i>DigTheWorld
        </h1>
        <p className="strapline">Dig a hole. See where you come out.</p>
      </header>

      <main className="stage">
        <div className="stage__globe">
          {/* The globe needs WebGL. Without it, say so and leave the sample digs usable. */}
          <ErrorBoundary
            fallback={
              <div className="globe-fallback">
                <p className="globe-fallback__title">The 3D globe could not start in this browser.</p>
                <p>You can still explore the sample digs.</p>
              </div>
            }
          >
            <GlobeView ref={globeRef} origin={origin} exit={exit} onPick={dropPin} />
            {!origin && <p className="hint">Click anywhere on the globe to set down your digger</p>}
          </ErrorBoundary>
        </div>

        <DigPanel
          origin={origin}
          exit={exit}
          dig={selection?.dig ?? null}
          sampleDigs={MOCK_DIGS}
          viewing={viewing}
          onPickSample={pickSample}
          onToggleView={toggleView}
          onReset={reset}
        />
      </main>
    </div>
  );
}
