'use client';

/**
 * Homepage hero: a single Surface panel (copy | live map readout) in the home edition
 * flow. The persistent `MapStage` canvas stays mounted for ADR-017 explore handoff; on `/`
 * it is positioned over the hero map column so real archive pins fill the readout beside the opaque copy
 * column (see `hero-map-inset.ts` + map-surfaces.css). Engagement clears the inset, flies
 * the live camera, then routes through `engage()` so the transition continues on `/explore`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice } from '@repo/ui';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { CAMERA_POINT_ZOOM } from '../../lib/map-experience/camera-presets';
import {
  applyHeroMapInset,
  clearHeroMapInset,
} from '../../lib/map-experience/hero-map-inset';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import type { DecadeFlowFrame } from '../../lib/map-experience/decade-flow';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import {
  buildExploreHref,
  defaultExploreOverlayState,
  viewportForState,
  type ExploreViewport,
  type ExploreViewportFrame,
} from '../../lib/map-experience/url-state';
import {
  CLOSE_BEYOND_COUNTY_ZOOM,
  resolveCloseCameraTarget,
} from '../../lib/map-experience/close-camera';
import { shouldFadeDecadePatch } from '../map/decade-layer-transition';
import { HeroHeadlineMorph } from './HeroHeadlineMorph';
import { useMapStage } from './MapStage';

export type HeroStageProps = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly featureCount: number;
  /** Distinct states/districts with at least one pinned record. */
  readonly stateCount: number;
  /** Decades-in-motion frames (newest → oldest, closed by the full-archive frame). */
  readonly decadeFrames: readonly DecadeFlowFrame[];
  /** e.g. "1820s–1970s"; omitted when the release carries no dated records. */
  readonly eraSpan?: string | undefined;
};

const RESTING_HREF = buildExploreHref({
  filters: DEFAULT_EXPLORE_FILTERS,
  ...defaultExploreOverlayState(),
});
const TRANSITION_FLAG = 'ds-map-transition';
const PLACE_SCROLL_TARGET = '#beat-a';

function markTransition(): void {
  try {
    window.sessionStorage.setItem(TRANSITION_FLAG, '1');
  } catch {
    // Storage unavailable — flight and navigation still happen.
  }
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function displayEraSpan(eraSpan: string | undefined): string {
  if (!eraSpan) return 'Eras vary';
  return eraSpan.replace(/\u2013|\u2014/g, ' to ');
}

function KickerTickIcon() {
  return (
    <svg className="ds-home-hero__kicker-tick" viewBox="0 0 20 12" fill="none" aria-hidden="true">
      <path
        d="M1 8 Q4 2, 8 6 T16 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 3 L17 4 L16 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function ScrollCueIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3 5 L7 9 L11 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function completeFrameIndex(frames: readonly DecadeFlowFrame[]): number {
  if (frames.length === 0) return 0;
  const completeIndex = frames.findIndex((frame) => frame.isComplete);
  return completeIndex >= 0 ? completeIndex : frames.length - 1;
}

export function HeroStage({
  featureCollection,
  jurisdictionAreaFeatures,
  featureCount,
  stateCount,
  decadeFrames,
  eraSpan,
}: HeroStageProps) {
  const router = useRouter();
  const stage = useMapStage();
  const stageApiRef = useRef(stage);
  stageApiRef.current = stage;
  const heroPanelRef = useRef<HTMLElement | null>(null);
  const mapColumnRef = useRef<HTMLDivElement | null>(null);
  const [dissolving, setDissolving] = useState(false);
  const archiveFrameIndex = completeFrameIndex(decadeFrames);

  const engage = useCallback(
    (href: string) => {
      markTransition();
      clearHeroMapInset();
      setDissolving(true);
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    const api = stageApiRef.current;
    api.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: undefined,
    });

    api.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });

    let viewport: ExploreViewportFrame | undefined;
    const unsubscribe = api.subscribe('viewport', (frame) => {
      viewport = frame;
    });
    unsubscribe();

    if (!viewport || viewport.zoom <= CLOSE_BEYOND_COUNTY_ZOOM) {
      return;
    }

    const target = resolveCloseCameraTarget({
      preSelectViewport: { lat: viewport.lat, lng: viewport.lng, zoom: viewport.zoom },
    });

    if (target.preset === 'national') {
      api.flyPreset('national', { bounds: target.bounds }, { mode: 'ease' });
      return;
    }

    api.flyPreset(
      target.preset,
      { center: target.center, zoom: target.zoom },
      { mode: 'ease' },
    );
  }, []);

  useEffect(() => {
    const panel = heroPanelRef.current;
    const mapColumn = mapColumnRef.current;
    const insetTarget = mapColumn ?? panel;
    if (!insetTarget || !stage.mapAvailable) return undefined;

    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (applyHeroMapInset(insetTarget)) {
          stageApiRef.current.resize();
        }
      });
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(insetTarget);
    if (panel && panel !== insetTarget) {
      observer.observe(panel);
    }
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      clearHeroMapInset();
    };
  }, [stage.mapAvailable]);

  const archiveFrame = decadeFrames[archiveFrameIndex];
  const archiveDecade = archiveFrame?.decade ?? '';
  const archiveComplete = archiveFrame?.isComplete ?? false;

  useEffect(() => {
    const api = stageApiRef.current;
    const frame = decadeFrames[archiveFrameIndex];
    const fade = shouldFadeDecadePatch({
      reducedMotion: false,
      isInitialApply: true,
    });

    if (!frame) {
      api.patchData(
        {
          featureCollection,
          jurisdictionAreaFeatures,
          layerMode: 'off',
          densityLevels: [],
          countyChoroplethLevels: [],
          historyEdgesEnabled: false,
          historyEdgeCollection: { type: 'FeatureCollection', features: [] },
        },
        { memorialComplete: true },
      );
      return;
    }

    api.patchData(
      {
        featureCollection: frame.featureCollection,
        jurisdictionAreaFeatures,
        layerMode: 'presence',
        densityLevels: frame.densityLevels,
        countyChoroplethLevels: [],
        historyEdgesEnabled: frame.edgeCollection.features.length > 0,
        historyEdgeCollection: frame.edgeCollection,
      },
      {
        ...(fade ? { fade: true } : {}),
        ...(frame.isComplete ? { memorialComplete: true } : { memorialDecade: frame.decade }),
      },
    );
  }, [
    archiveFrameIndex,
    archiveDecade,
    archiveComplete,
    decadeFrames,
    featureCollection,
    jurisdictionAreaFeatures,
  ]);

  useEffect(() => {
    const unsubscribe = [
      stage.subscribe('select', (entityId: string) => {
        const feature = featureCollection.features.find(
          (item) => item.properties.entityId === entityId,
        );
        if (feature?.geometry.type === 'Point') {
          const [lng, lat] = feature.geometry.coordinates;
          stage.flyPreset('point', { center: [lng, lat], zoom: CAMERA_POINT_ZOOM });
          engage(
            buildExploreHref({
              filters: DEFAULT_EXPLORE_FILTERS,
              ...defaultExploreOverlayState(),
              selected: entityId,
              viewport: { lat, lng, zoom: CAMERA_POINT_ZOOM },
            }),
          );
          return;
        }
        const href = feature?.properties.href ?? `/entity/${encodeURIComponent(entityId)}`;
        router.push(href);
      }),
      stage.subscribe('stateSelect', (postalCode: string) => {
        const viewport = viewportForState(postalCode);
        if (viewport) {
          stage.flyPreset('state', { center: [viewport.lng, viewport.lat], zoom: viewport.zoom });
        }
        engage(
          buildExploreHref({
            filters: DEFAULT_EXPLORE_FILTERS,
            ...defaultExploreOverlayState(),
            state: postalCode,
          }),
        );
      }),
      stage.subscribe('activate', (viewport: ExploreViewport) => {
        stage.flyPreset('locality', { center: [viewport.lng, viewport.lat], zoom: viewport.zoom });
        engage(
          buildExploreHref({
            filters: DEFAULT_EXPLORE_FILTERS,
            ...defaultExploreOverlayState(),
            viewport,
          }),
        );
      }),
    ];
    return () => {
      for (const unsub of unsubscribe) unsub();
    };
  }, [stage, featureCollection, engage, router]);

  function handleExploreClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    stage.flyPreset('national', { bounds: US_CONUS_BOUNDS });
    engage(RESTING_HREF);
  }

  const stateLabel = `${stateCount} state${stateCount === 1 ? '' : 's'}`;
  const eraFact = displayEraSpan(eraSpan);

  return (
    <section
      ref={heroPanelRef}
      className={
        dissolving
          ? 'ds-home-hero ds-hero-stage ds-hero-stage--dissolving'
          : 'ds-home-hero ds-hero-stage'
      }
      data-hero-map-panel="true"
      aria-labelledby="hero-headline"
    >
      {!stage.mapAvailable ? (
        <Notice tone="warning" title="Map unavailable">
          The map canvas could not start in this browser. Use Explore to browse documented records
          as a list.
        </Notice>
      ) : null}

      <div
        ref={mapColumnRef}
        className="ds-home-hero__map"
        aria-label="Live archive coverage map"
      >
        <div className="ds-home-hero__map-readout">
          <p className="ds-home-hero__map-caption">Live coverage · archive pins</p>
        </div>
      </div>

      <div className="ds-home-hero__copy">
        <p className="ds-home-hero__kicker">
          <KickerTickIcon />
          Place-connected archive
        </p>
        <HeroHeadlineMorph />
        <p className="ds-home-hero__lede">
          Every record ties to a place you can stand in. Start where you are, then follow the
          evidence across time.
        </p>
        <div className="ds-home-hero__ctas">
          <Link className="ds-cta ds-cta--copper" href="/locate">
            Find what happened near you
          </Link>
          <a
            className="ds-home-hero__cta-quiet"
            href={RESTING_HREF}
            onClick={handleExploreClick}
          >
            Explore the map
          </a>
        </div>
        <a className="ds-home-hero__scroll-cue" href={PLACE_SCROLL_TARGET}>
          Your place
          <ScrollCueIcon />
        </a>
        <div className="ds-home-hero__micro-facts" aria-label="Archive at a glance">
          <div className="ds-home-hero__micro-fact">
            <span className="ds-home-hero__micro-fact-value">{formatCount(featureCount)}</span>
            <span className="ds-home-hero__micro-fact-label">Records pinned</span>
          </div>
          <div className="ds-home-hero__micro-fact">
            <span className="ds-home-hero__micro-fact-value">{stateLabel}</span>
            <span className="ds-home-hero__micro-fact-label">On the map</span>
          </div>
          <div className="ds-home-hero__micro-fact">
            <span className="ds-home-hero__micro-fact-value">{eraFact}</span>
            <span className="ds-home-hero__micro-fact-label">Eras spanned</span>
          </div>
        </div>
      </div>
    </section>
  );
}
