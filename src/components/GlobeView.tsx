import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { LatLon } from '../../shared/types';
import { createMarkerElement, type MarkerKind } from './markers';

export interface GlobeViewHandle {
  /** Swings the camera round until it looks straight down at a point. */
  flyTo: (point: LatLon, ms?: number) => void;
}

interface Props {
  /** Where the explorer stands, or null before a spot is picked. */
  origin: LatLon | null;
  /** The antipode of origin, marked with a flag. */
  exit: LatLon | null;
  /**
   * Stops dragging from turning the globe, so a downward flick can mean "dig"
   * instead. Clicking a spot and camera moves made by the app still work.
   */
  locked: boolean;
  /** Stops rendering while another screen covers the globe. */
  paused: boolean;
  onPick: (point: LatLon) => void;
  ref?: Ref<GlobeViewHandle>;
}

interface Marker extends LatLon {
  kind: MarkerKind;
}

// globe.gl rebuilds every marker whenever these accessors change identity, so
// they are defined once here instead of inline in the JSX.
const markerElement = (d: object) => createMarkerElement((d as Marker).kind);

// By default the library hides far-side markers with display: none, which
// restarts their drop-in animation each time they come back round. Fading the
// opacity keeps the element alive.
const fadeMarker = (el: HTMLElement, isVisible: boolean) => {
  el.style.opacity = isVisible ? '1' : '0';
};

const GLOBE_RADIUS = 100; // globe.gl's fixed scene units
const FLY_MS = 1100;

export default function GlobeView({ origin, exit, locked, paused, onPick, ref }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  // react-globe.gl needs explicit pixel dimensions, so follow the wrapper's size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One-time camera setup, as soon as the globe exists.
  const hasGlobe = size !== null;
  useEffect(() => {
    const globe = globeRef.current;
    const el = wrapRef.current;
    if (!hasGlobe || !globe || !el) return;

    const controls = globe.controls();
    controls.enablePan = false;
    controls.minDistance = GLOBE_RADIUS * 1.35;
    controls.maxDistance = GLOBE_RADIUS * 5.2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    const stopSpinning = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stopSpinning);

    // Pull back on tall, narrow screens so the whole globe stays in frame.
    const aspect = el.clientWidth / el.clientHeight;
    globe.pointOfView({ lat: 22, lng: -35, altitude: Math.max(2, 2.1 / aspect) }, 0);

    return () => controls.removeEventListener('start', stopSpinning);
  }, [hasGlobe]);

  useEffect(() => {
    const globe = globeRef.current;
    if (hasGlobe && globe) globe.controls().enableRotate = !locked;
  }, [hasGlobe, locked]);

  useEffect(() => {
    const globe = globeRef.current;
    if (!hasGlobe || !globe) return;
    if (paused) globe.pauseAnimation();
    else globe.resumeAnimation();
  }, [hasGlobe, paused]);

  const flyTo = useCallback((point: LatLon, ms = FLY_MS) => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: point.lat, lng: point.lon }, ms);
  }, []);

  useImperativeHandle(ref, () => ({ flyTo }), [flyTo]);

  // Bring a freshly placed explorer to the centre of the view.
  useEffect(() => {
    if (origin) flyTo(origin);
  }, [origin, flyTo]);

  const markers = useMemo<Marker[]>(
    () => (origin && exit ? [{ ...origin, kind: 'explorer' }, { ...exit, kind: 'flag' }] : []),
    [origin, exit],
  );

  const handleClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => onPick({ lat, lon: lng }),
    [onPick],
  );

  return (
    <div className="globe" ref={wrapRef}>
      {size && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="/textures/earth-blue-marble.jpg"
          bumpImageUrl="/textures/earth-topology.png"
          atmosphereColor="#8fc1ff"
          atmosphereAltitude={0.14}
          onGlobeClick={handleClick}
          htmlElementsData={markers}
          htmlLng="lon"
          htmlAltitude={0}
          htmlElement={markerElement}
          htmlElementVisibilityModifier={fadeMarker}
          htmlTransitionDuration={0}
        />
      )}
    </div>
  );
}
