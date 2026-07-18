'use client';

/**
 * Homepage hero chrome (BB-098): DOM contract per design-direction-v3.md "Homepage (the hero IS
 * the map)" — `.bp-hero-stage` markup is law, `map-surfaces.css` owns the visual styling. The
 * live `MapStage` canvas renders behind this (mounted once, at the `(map)` layout) `HeroStage`
 * only renders the floating chrome and wires it to the shared stage through `useMapStage()`.
 *
 * Engagement contract (ADR-017 "Transition contract"): a state click, a point click, a
 * background click, or the copper CTA all funnel through `engage()` — fly the matching camera
 * preset AND `router.push('/explore?…')` in the same tick; the flight continues uninterrupted
 * across the navigation because the stage never unmounts. Hero chrome dissolves via a token-driven
 * CSS class (`--bp-duration-base`, opacity/translate only) while that push resolves.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice } from '@blap/ui';
import { US_CONUS_BOUNDS } from '@blap/domain/map/geography';
import { CAMERA_POINT_ZOOM } from '../../lib/map-experience/camera-presets';
import type {
  ExploreMapFeatureCollection,
  JurisdictionAreaFeature,
} from '../../lib/map-experience/build-explore-map-source';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { buildExploreHref, viewportForState, type ExploreViewport } from '../../lib/map-experience/url-state';
import { useMapStage } from './MapStage';

export type HeroStageProps = {
  readonly featureCollection: ExploreMapFeatureCollection;
  readonly jurisdictionAreaFeatures: readonly JurisdictionAreaFeature[];
  readonly featureCount: number;
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

export function HeroStage({ featureCollection, jurisdictionAreaFeatures, featureCount, liveData }: HeroStageProps) {
  const router = useRouter();
  const stage = useMapStage();
  const [dissolving, setDissolving] = useState(false);

  const engage = useCallback(
    (href: string) => {
      markTransition();
      setDissolving(true);
      router.push(href);
    },
    [router],
  );

  // Landing on `/` always resets the shared canvas to its resting, unfiltered view and eases the
  // camera back to the national frame — `/explore` may have left it filtered, density-tinted, or
  // state-highlighted (ADR-017: "the reverse transition eases back to the national preset as
  // hero chrome returns").
  useEffect(() => {
    stage.patchData({
      featureCollection,
      jurisdictionAreaFeatures,
      densityEnabled: false,
      densityLevels: [],
      historyEdgesEnabled: false,
      historyEdgeCollection: { type: 'FeatureCollection', features: [] },
    });
    stage.applyViewState({ selectedState: undefined, selectedEdge: undefined });
    stage.flyPreset('national', { bounds: US_CONUS_BOUNDS }, { mode: 'ease' });
  }, [stage, featureCollection, jurisdictionAreaFeatures]);

  useEffect(() => {
    const unsubscribe = [
      stage.subscribe('select', (entityId: string) => {
        const coordinates = coordinatesOf(featureCollection, entityId);
        if (coordinates) {
          stage.flyPreset('point', { center: coordinates, zoom: CAMERA_POINT_ZOOM });
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

  return (
    <section
      className={dissolving ? 'bp-hero-stage bp-hero-stage--dissolving' : 'bp-hero-stage'}
      aria-labelledby="hero-headline"
    >
      <div className="bp-hero-stage__scrim" aria-hidden="true" />
      <div className="bp-hero-stage__panel">
        {!stage.mapAvailable ? (
          <Notice tone="warning" title="Map unavailable">
            The map canvas could not start in this browser. Use Explore to browse documented
            records as a list.
          </Notice>
        ) : null}
        <p className="bp-hero-stage__kicker">Place-connected Black history</p>
        <h1 className="bp-hero-stage__headline" id="hero-headline">
          History, pinned to place.
        </h1>
        <p className="bp-hero-stage__support">
          People. Places. Evidence. Context. Drag the map, tap a state or a pin, or open the full
          archive below.
        </p>
        <div className="bp-hero-stage__actions">
          <a className="bp-cta bp-cta--copper" href={RESTING_HREF} onClick={handleCtaClick}>
            Explore the map
          </a>
          <Link className="bp-cta bp-cta--ghost-dark" href="/methodology">
            How records qualify
          </Link>
        </div>
        <p className="bp-hero-stage__count">
          {featureCount} record{featureCount === 1 ? '' : 's'} pinned
          {liveData ? '' : ' · sample data'}
        </p>
      </div>
    </section>
  );
}
