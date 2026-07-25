'use client';

/**
 * Homepage hero: a single Surface panel (copy | live map readout) in the home edition
 * flow. The persistent `MapStage` canvas stays mounted for ADR-017 explore handoff; on `/`
 * it is positioned over the full hero panel so basemap + archive pins extend under the
 * lightly scrimmed copy column (see `hero-map-inset.ts` + map-surfaces.css). Engagement
 * clears the inset, flies the live camera, then routes through `engage()` so the transition
 * continues on `/explore`.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice } from '@repo/ui';
import { US_CONUS_BOUNDS } from '@repo/domain/map/geography';
import { CAMERA_POINT_ZOOM } from '../../lib/map-experience/camera-presets';
import {
  applyHeroMapInset,
  clearHeroMapInset,
  heroNationalCameraPadding,
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
import {
  CinematicMapProvider,
  useCinematicMap,
  type CinematicMapDriver,
} from '../../components/patterns/cinematic-map/CinematicMapProvider';
import { CinematicScrim } from '../../components/patterns/cinematic-map/CinematicScrim';
import { ExploreMapControl } from '../../components/patterns/cinematic-map/ExploreMapControl';
import { CinematicMapClose } from '../../components/patterns/cinematic-map/CinematicMapClose';
import { MapIntroBeat } from '../../components/patterns/cinematic-map/MapIntroBeat';

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

/** Up to two point-geometry features to drive the home Invite beats (spec §1 Invite row).
 * Home is a landing/narrative surface, so a short scroll-driven camera sequence is in scope
 * (§1 "When to use"). Falls back to zero beats gracefully when the release has no point pins. */
function inviteBeatEntities(
  featureCollection: ExploreMapFeatureCollection,
): readonly ExploreMapFeatureCollection['features'][number][] {
  return featureCollection.features.filter((feature) => feature.geometry.type === 'Point').slice(0, 2);
}

/** Wraps its children in a `MapIntroBeat` scroll-anchor when a beat entity is available;
 * otherwise renders the children plain (no release features -> no Invite sequence, §1
 * "graceful when the release has no point pins"). Keeps `HeroStagePanel`'s JSX from branching
 * on `entityId` presence at every call site. */
function HeroInviteBeat({
  beat,
  preset = 'national',
  children,
}: {
  readonly beat: ExploreMapFeatureCollection['features'][number] | undefined;
  readonly preset?: 'national' | 'state' | 'locality' | 'point';
  readonly children: ReactNode;
}) {
  if (!beat) return <>{children}</>;
  return (
    <MapIntroBeat preset={preset} entityId={beat.properties.entityId}>
      {children}
    </MapIntroBeat>
  );
}

export function HeroStage(props: HeroStageProps) {
  const stage = useMapStage();
  const stageApiRef = useRef(stage);
  stageApiRef.current = stage;
  const { featureCollection } = props;

  const driver = useMemo<CinematicMapDriver>(
    () => ({
      select: (entityId: string) => {
        const feature = featureCollection.features.find(
          (item) => item.properties.entityId === entityId,
        );
        stageApiRef.current.applyViewState({
          selectedState: undefined,
          selectedEdge: undefined,
          selectedEntity: entityId,
        });
        if (feature?.geometry.type === 'Point') {
          const [lng, lat] = feature.geometry.coordinates;
          stageApiRef.current.flyPreset('point', { center: [lng, lat], zoom: CAMERA_POINT_ZOOM });
        }
      },
      deselect: () => {
        stageApiRef.current.applyViewState({
          selectedState: undefined,
          selectedEdge: undefined,
          selectedEntity: undefined,
        });
      },
      flyTo: (preset) => {
        if (preset !== 'national') return;
        stageApiRef.current.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
      },
    }),
    [featureCollection],
  );

  return (
    <CinematicMapProvider homePreset="national" driver={driver}>
      <HeroStagePanel {...props} />
    </CinematicMapProvider>
  );
}

function HeroStagePanel({
  featureCollection,
  jurisdictionAreaFeatures,
  featureCount,
  stateCount,
  decadeFrames,
  eraSpan,
}: HeroStageProps) {
  const router = useRouter();
  const stage = useMapStage();
  const cinematic = useCinematicMap();
  const cinematicStateRef = useRef(cinematic.state);
  cinematicStateRef.current = cinematic.state;
  const stageApiRef = useRef(stage);
  stageApiRef.current = stage;
  const heroPanelRef = useRef<HTMLElement | null>(null);
  const copyColumnRef = useRef<HTMLDivElement | null>(null);
  const [dissolving, setDissolving] = useState(false);
  const archiveFrameIndex = completeFrameIndex(decadeFrames);
  const inviteBeats = inviteBeatEntities(featureCollection);

  /** Deep-action navigation: selecting a specific entity/state, or the legacy full-hero
   * dissolve-to-/explore handoff. The base "Explore the map" control no longer routes away
   * (spec §1: Engaged happens in place) — only these deliberate deep actions still navigate. */
  const navigateToExplore = useCallback(
    (href: string) => {
      markTransition();
      clearHeroMapInset();
      setDissolving(true);
      router.push(href);
    },
    [router],
  );

  // Engage in place: unlock the full-bleed interactive map; Close (spec §2 rule 4) relocks and
  // restores the hero inset + home camera via `cinematic.close()` -> the driver's `flyTo`.
  useEffect(() => {
    const panel = heroPanelRef.current;
    if (cinematic.state === 'engaged') {
      clearHeroMapInset();
      stageApiRef.current.resize();
      stageApiRef.current.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
    } else if (panel) {
      applyHeroMapInset(panel);
      stageApiRef.current.resize();
    }
  }, [cinematic.state]);

  useEffect(() => {
    const api = stageApiRef.current;
    api.applyViewState({
      selectedState: undefined,
      selectedEdge: undefined,
      selectedEntity: undefined,
    });

    // National framing with hero padding is owned by the inset sync effect once the
    // full-panel MapStage box is measured — avoids a map-column-sized first paint then jump.
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
    const copy = copyColumnRef.current;
    if (!panel || !stage.mapAvailable) return undefined;

    let raf = 0;
    let lastWidth = 0;
    let lastHeight = 0;

    const frameNational = () => {
      const panelRect = panel.getBoundingClientRect();
      const copyRect = copy?.getBoundingClientRect() ?? null;
      stageApiRef.current.flyPreset(
        'national',
        { bounds: US_CONUS_BOUNDS },
        {
          mode: 'ease',
          padding: heroNationalCameraPadding({ panel: panelRect, copy: copyRect }),
        },
      );
    };

    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Engaged: the plate is full-bleed (spec §5 Engaged behavior); the inset-follow loop
        // stays inert so it never fights the driver's engage/close camera calls.
        if (cinematicStateRef.current === 'engaged') return;
        if (!applyHeroMapInset(panel)) return;
        stageApiRef.current.resize();
        const rect = panel.getBoundingClientRect();
        const sizeChanged =
          Math.abs(rect.width - lastWidth) > 1 || Math.abs(rect.height - lastHeight) > 1;
        if (sizeChanged) {
          lastWidth = rect.width;
          lastHeight = rect.height;
          frameNational();
        }
      });
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(panel);
    if (copy) observer.observe(copy);
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
          navigateToExplore(
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
        navigateToExplore(
          buildExploreHref({
            filters: DEFAULT_EXPLORE_FILTERS,
            ...defaultExploreOverlayState(),
            state: postalCode,
          }),
        );
      }),
      stage.subscribe('activate', (viewport: ExploreViewport) => {
        stage.flyPreset('locality', { center: [viewport.lng, viewport.lat], zoom: viewport.zoom });
        navigateToExplore(
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
  }, [stage, featureCollection, navigateToExplore, router]);

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

      <CinematicScrim />

      <div className="ds-home-hero__map" aria-label="Live archive coverage map">
        <div className="ds-home-hero__map-readout">
          <p className="ds-home-hero__map-caption">Live coverage · archive pins</p>
        </div>
      </div>

      <div
        className="ds-cinematic-rail"
        style={{ gridColumn: '1 / -1', gridRow: 1, justifySelf: 'end', alignSelf: 'start' }}
      >
        <CinematicMapClose />
      </div>

      <div ref={copyColumnRef} className="ds-home-hero__copy">
        <div className="ds-cinematic-content" data-cinematic-state={cinematic.state}>
          {/* Lead beat: always in view at first paint (no scroll yet), so its copy is not
              gated behind `MapIntroBeat`'s IntersectionObserver — firing a camera flight before
              the initial national framing settles would risk the "no map flash on load"
              acceptance criterion. `HeroHeadlineMorph` is preserved as the lead beat's copy
              per the bead description; the camera sequence itself begins at the second beat,
              once the reader has actually scrolled. */}
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
            <ExploreMapControl className="ds-home-hero__cta-quiet" label="Explore the map" />
          </div>
          <a className="ds-home-hero__scroll-cue" href={PLACE_SCROLL_TARGET}>
            Your place
            <ScrollCueIcon />
          </a>
          <HeroInviteBeat beat={inviteBeats[0]} preset="locality">
            <div className="ds-home-hero__micro-facts" aria-label="Archive at a glance">
              <div className="ds-home-hero__micro-fact">
                <span className="ds-home-hero__micro-fact-value">
                  {formatCount(featureCount)}
                </span>
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
          </HeroInviteBeat>
        </div>
      </div>
    </section>
  );
}
