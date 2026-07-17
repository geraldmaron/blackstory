'use client';

/**
 * Map-led homepage hero: interactive US archive canvas. Pan/zoom/click enter Explore;
 * circular entity pins deep-link into Explore with selection.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StyleSpecification } from 'maplibre-gl';
import { Notice } from '@black-book/ui';
import { buildExploreHref, type ExploreViewport } from '../lib/map-experience/url-state';
import {
  ExploreMapCanvas,
  type ExploreMapCanvasProps,
} from './map/ExploreMapCanvas';

export type HomeMapHeroProps = {
  readonly mapStyle: StyleSpecification;
  readonly featureCollection: ExploreMapCanvasProps['featureCollection'];
  readonly bounds: ExploreMapCanvasProps['bounds'];
  readonly densityLevels: NonNullable<ExploreMapCanvasProps['densityLevels']>;
  readonly initialViewport?: ExploreMapCanvasProps['initialViewport'];
  readonly showSeedNotice?: boolean;
  readonly featureCount: number;
};

export function HomeMapHero({
  mapStyle,
  featureCollection,
  bounds,
  densityLevels,
  initialViewport,
  showSeedNotice = false,
  featureCount,
}: HomeMapHeroProps) {
  const router = useRouter();
  const [mapAvailable, setMapAvailable] = useState(true);
  const [lastViewport, setLastViewport] = useState<ExploreViewport | undefined>(initialViewport);

  useEffect(() => {
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
    return () => window.clearTimeout(id);
  }, []);

  function enterExplore(patch: {
    readonly selected?: string;
    readonly state?: string;
    readonly viewport?: ExploreViewport;
  }) {
    const viewport = patch.viewport ?? lastViewport;
    router.push(
      buildExploreHref({
        filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
        density: false,
        lines: false,
        ...(viewport ? { viewport } : {}),
        ...(patch.selected ? { selected: patch.selected } : {}),
        ...(patch.state ? { state: patch.state } : {}),
      }),
    );
  }

  return (
    <section className="bb-home-map-hero" aria-labelledby="hero-brand">
      {mapAvailable ? (
        <ExploreMapCanvas
          className="bb-home-map-hero__canvas"
          style={mapStyle}
          featureCollection={featureCollection}
          bounds={bounds}
          {...(initialViewport ? { initialViewport } : {})}
          densityEnabled={false}
          densityLevels={densityLevels}
          activateOnBackgroundClick
          onSelect={(entityId: string) => {
            enterExplore({ selected: entityId });
          }}
          onStateSelect={(postalCode: string) => {
            enterExplore({ state: postalCode });
          }}
          onActivate={(viewport) => {
            enterExplore({ viewport });
          }}
          onViewportChange={setLastViewport}
          onMapError={() => setMapAvailable(false)}
        />
      ) : (
        <div className="bb-home-map-hero__fallback">
          <Notice tone="warning" title="Map unavailable">
            The map canvas could not start in this browser. Use Explore to browse documented
            records as a list.
          </Notice>
        </div>
      )}

      <div className="bb-home-map-hero__chrome">
        <div className="bb-home-map-hero__inner">
          {showSeedNotice ? (
            <p className="bb-home-map-hero__seed" role="status">
              Sample seed data — local fixtures, not a live public release.
            </p>
          ) : null}
          <p id="hero-brand" className="bb-home-map-hero__brand">
            Black Book
          </p>
          <h1 className="bb-home-map-hero__headline">History, pinned to place.</h1>
          <p className="bb-home-map-hero__support">
            {featureCount} documented record{featureCount === 1 ? '' : 's'} on the map —
            drag, click a state or pin, or open the full map experience.
          </p>
          <div className="bb-home-map-hero__actions">
            <a
              className="bb-cta bb-cta--solid"
              href={buildExploreHref({
                filters: { era: 'all', kind: 'all', theme: 'all', confidence: 'all' },
                density: false,
                lines: false,
                ...(lastViewport ? { viewport: lastViewport } : {}),
              })}
            >
              Enter the map
            </a>
            <a className="bb-cta bb-cta--ghost" href="/search">
              Search records
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
