'use client';

/**
 * Homepage hero chrome (BB-098): cinema over the live plate. The persistent
 * `MapStage` canvas renders behind this (mounted once, at the `(map)` layout);
 * `HeroStage` renders the floating typography and the TIMELINE INSTRUMENT —
 * a full-width rail of decade ticks that plays the archive decade by decade
 * (decade-flow.ts), scrubbable by tap, pausable, honest about what it shows
 * (documented records, never modeled population).
 *
 * Engagement contract (ADR-017 "Transition contract"): a state click, a point
 * click, a background click, or the copper CTA all funnel through `engage()` —
 * fly the matching camera preset AND `router.push('/explore?…')` in the same
 * tick; the flight continues uninterrupted across the navigation because the
 * stage never unmounts.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice } from '@blap/ui';
import { US_CONUS_BOUNDS } from '@blap/domain/map/geography';
import { CAMERA_POINT_ZOOM, prefersReducedMotion } from '../../lib/map-experience/camera-presets';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import { FINAL_FRAME_LABEL, type DecadeFlowFrame } from '../../lib/map-experience/decade-flow';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { buildExploreHref, viewportForState, type ExploreViewport } from '../../lib/map-experience/url-state';
import { useMapStage } from './MapStage';

/** Dwell per decade frame — slow enough to read, fast enough to feel alive. */
const DECADE_FRAME_MS = 3600;

export type HeroStageProps = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly featureCount: number;
  /** Distinct states/districts with at least one pinned record. */
  readonly stateCount: number;
  /** Decades-in-motion frames (newest → oldest, closed by the full-archive frame). */
  readonly decadeFrames: readonly DecadeFlowFrame[];
  /** True when the page is reading live public projections; the count line's "sample data"
   * qualifier only renders on the snapshot/seed fallback. */
  readonly liveData: boolean;
};

const RESTING_HREF = buildExploreHref({ filters: DEFAULT_EXPLORE_FILTERS, density: false, lines: false });
const TRANSITION_FLAG = 'bp-map-transition';

function coordinatesOf(
  collection: ExploreMapFeatureCollection,
  entityId: string,
): readonly [lng: number, lat: number] | undefined {
  const feature = collection.features.find((item) => item.properties.entityId === entityId);
  if (!feature || feature.geometry.type !== 'Point') return undefined;
  const [lng, lat] = feature.geometry.coordinates;
  return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : undefined;
}

function markTransition(): void {
  try {
    window.sessionStorage.setItem(TRANSITION_FLAG, '1');
  } catch {
    // Storage unavailable (private browsing) — the flight and navigation still happen; only the
    // post-landing focus handoff is best-effort.
  }
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3.2" height="11" rx="0.8" />
      <rect x="9.3" y="2.5" width="3.2" height="11" rx="0.8" />
    </svg>
  );
}

export function HeroStage({
  featureCollection,
  jurisdictionAreaFeatures,
  featureCount,
  stateCount,
  decadeFrames,
  liveData,
}: HeroStageProps) {
  const router = useRouter();
  const stage = useMapStage();
  const [dissolving, setDissolving] = useState(false);

  // Decades in motion: rewind newest → oldest, then land on the complete archive.
  // Reduced motion starts paused on the complete archive; play remains a
  // deliberate, user-initiated choice there.
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    setReducedMotion(reduced);
    if (reduced || decadeFrames.length <= 1) {
      setFrameIndex(Math.max(0, decadeFrames.length - 1));
      setPlaying(false);
    } else {
      setFrameIndex(0);
      setPlaying(true);
    }
  }, [decadeFrames.length]);

  const engage = useCallback(
    (href: string) => {
      markTransition();
      setDissolving(true);
      setPlaying(false);
      router.push(href);
    },
    [router],
  );

  // Landing on `/` resets selection state and eases the camera back to the national
  // frame (ADR-017: "the reverse transition eases back to the national preset as
  // hero chrome returns"); the decade-flow effect below owns the data patches.
  useEffect(() => {
    stage.applyViewState({ selectedState: undefined, selectedEdge: undefined, selectedEntity: undefined });
    stage.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
  }, [stage]);

  // Apply the current decade frame to the shared canvas.
  useEffect(() => {
    const frame = decadeFrames[frameIndex];
    if (!frame) {
      stage.patchData({
        featureCollection,
        jurisdictionAreaFeatures,
        densityEnabled: false,
        densityLevels: [],
        historyEdgesEnabled: false,
        historyEdgeCollection: { type: 'FeatureCollection', features: [] },
      });
      return;
    }
    stage.patchData({
      featureCollection: frame.featureCollection,
      jurisdictionAreaFeatures,
      densityEnabled: frame.densityLevels.length > 0,
      densityLevels: frame.densityLevels,
      historyEdgesEnabled: frame.edgeCollection.features.length > 0,
      historyEdgeCollection: frame.edgeCollection,
    });
  }, [stage, decadeFrames, frameIndex, featureCollection, jurisdictionAreaFeatures]);

  // Auto-advance while playing; loops through the closing full-archive frame.
  useEffect(() => {
    if (!playing || dissolving || decadeFrames.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setFrameIndex((index) => (index + 1) % decadeFrames.length);
    }, DECADE_FRAME_MS);
    return () => window.clearInterval(timer);
  }, [playing, dissolving, decadeFrames.length]);

  useEffect(() => {
    const unsubscribe = [
      stage.subscribe('select', (entityId: string) => {
        const coordinates = coordinatesOf(featureCollection, entityId);
        if (coordinates) {
          stage.flyPreset(
            'point',
            { center: coordinates, zoom: CAMERA_POINT_ZOOM },
            { padding: { top: 72, bottom: 280, left: 48, right: 48 } },
          );
        }
        engage(buildExploreHref({ filters: DEFAULT_EXPLORE_FILTERS, density: false, lines: false, selected: entityId }));
      }),
      stage.subscribe('stateSelect', (postalCode: string) => {
        const viewport = viewportForState(postalCode);
        if (viewport) {
          stage.flyPreset('state', { center: [viewport.lng, viewport.lat], zoom: viewport.zoom });
        }
        engage(buildExploreHref({ filters: DEFAULT_EXPLORE_FILTERS, density: false, lines: false, state: postalCode }));
      }),
      stage.subscribe('activate', (viewport: ExploreViewport) => {
        engage(buildExploreHref({ filters: DEFAULT_EXPLORE_FILTERS, density: false, lines: false, viewport }));
      }),
    ];
    return () => {
      for (const unsub of unsubscribe) unsub();
    };
  }, [stage, featureCollection, engage]);

  function handleCtaClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    engage(RESTING_HREF);
  }

  const currentFrame = decadeFrames[frameIndex];

  return (
    <section
      className={dissolving ? 'bp-hero-stage bp-hero-stage--dissolving' : 'bp-hero-stage'}
      aria-labelledby="hero-headline"
    >
      {!stage.mapAvailable ? (
        <Notice tone="warning" title="Map unavailable">
          The map canvas could not start in this browser. Use Explore to browse documented
          records as a list.
        </Notice>
      ) : null}
      <p className="bp-hero-stage__kicker">Documented Black history</p>
      <h1 className="bp-hero-stage__headline" id="hero-headline">
        History happened <em>here</em>.
      </h1>
      <p className="bp-hero-stage__support">
        Every pin is a documented record — people, places, schools, and events, each carrying its
        evidence. Start with the places you know.
      </p>
      <div className="bp-hero-stage__actions">
        <Link className="bp-cta bp-cta--copper" href="/locate">
          Find what happened near you
        </Link>
        <a className="bp-cta bp-cta--ghost" href={RESTING_HREF} onClick={handleCtaClick}>
          Explore the map
        </a>
      </div>

      {decadeFrames.length > 1 ? (
        <div className="bp-hero-timeline" role="group" aria-label="Decades in motion, newest to oldest">
          <div className="bp-hero-timeline__head">
            <div className="bp-hero-timeline__readout" aria-live="polite">
              <p className="bp-hero-timeline__decade">
                {currentFrame?.decade ?? FINAL_FRAME_LABEL}
              </p>
              <p className="bp-hero-timeline__note">
                {currentFrame?.isComplete
                  ? `${currentFrame?.cumulativeCount ?? featureCount} records · ${stateCount} states${liveData ? '' : ' · sample data'}`
                  : `${currentFrame?.cumulativeCount ?? 0} records documented through this decade`}
              </p>
            </div>
            <button
              type="button"
              className="bp-hero-timeline__toggle"
              aria-pressed={playing}
              aria-label={playing ? 'Pause the decade-by-decade animation' : 'Play the decade-by-decade animation'}
              onClick={() => {
                if (!playing && reducedMotion) {
                  // Under reduced motion, play is still a deliberate choice —
                  // honor it, but never start it automatically.
                  setFrameIndex(0);
                }
                setPlaying((current) => !current);
              }}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
          </div>
          <div className="bp-hero-timeline__rail">
            {decadeFrames.map((frame, index) => {
              const state =
                index === frameIndex ? 'is-current' : index < frameIndex ? 'is-passed' : '';
              return (
                <button
                  key={frame.decade}
                  type="button"
                  className={state ? `bp-hero-timeline__tick ${state}` : 'bp-hero-timeline__tick'}
                  aria-label={
                    frame.isComplete
                      ? 'Show the complete archive'
                      : `Show the map through the ${frame.decade}`
                  }
                  aria-current={index === frameIndex ? 'true' : undefined}
                  onClick={() => {
                    setPlaying(false);
                    setFrameIndex(index);
                  }}
                >
                  <span className="bp-hero-timeline__tick-label">{frame.decade}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="bp-hero-stage__count">
          {featureCount} record{featureCount === 1 ? '' : 's'} · {stateCount} state
          {stateCount === 1 ? '' : 's'}
          {liveData ? '' : ' · sample data'}
        </p>
      )}
    </section>
  );
}
