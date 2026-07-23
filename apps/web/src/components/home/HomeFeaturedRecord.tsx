'use client';

/**
 * Homepage beat 02: featured record carousel with prev/next, ordered/random browse mode,
 * facts strip, open record + show on map actions, and quiet related titles sidebar.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RecordBrowseControls } from '../patterns/RecordBrowseControls';
import type { BrowseMode } from '../patterns/browse-mode';
import { pickRandomIndex, stepIndex } from '../patterns/browse-mode';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { buildExploreHref, defaultExploreOverlayState } from '../../lib/map-experience/url-state';
import { geoAnchorFor } from '../../lib/map-experience/entity-geo';
import { HomeEditionHeader } from './HomeEditionHeader';
import {
  RecordAnatomyPanel,
  type RecordAnatomyFact,
  type RecordAnatomyPlace,
} from '../patterns/RecordAnatomyPanel';
import {
  eraFactFor,
  evidenceFactFor,
  evidenceTierFor,
  jurisdictionFactFor,
  kindLabelFor,
  type HomeFeaturedEntity,
} from './home-entity-facts';
import {
  geoPrecisionTierForPublicPrecision,
  radiusAffordanceLabel,
} from '../../lib/map-experience/geo-precision';

export type HomeFeaturedRecordProps = {
  readonly featured: readonly HomeFeaturedEntity[];
  /** Server-picked starting carousel index; defaults to 0 for tests and empty sets. */
  readonly initialIndex?: number;
};

function mapHrefFor(entity: HomeFeaturedEntity): string | undefined {
  const anchor = entity.geoAnchor ?? geoAnchorFor(entity.id);
  if (!anchor) return undefined;
  return buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    selected: entity.id,
    viewport: { lat: anchor.lat, lng: anchor.lng, zoom: 11 },
  });
}

function relatedTitles(featured: readonly HomeFeaturedEntity[], activeIndex: number) {
  return featured
    .map((entity, index) => ({ entity, index }))
    .filter(({ index }) => index !== activeIndex)
    .slice(0, 2);
}

export function HomeFeaturedRecord({ featured, initialIndex = 0 }: HomeFeaturedRecordProps) {
  const count = featured.length;
  const [index, setIndex] = useState(() =>
    count > 0 ? ((initialIndex % count) + count) % count : 0,
  );
  const [browseMode, setBrowseMode] = useState<BrowseMode>('ordered');
  const [animating, setAnimating] = useState(false);

  const safeIndex = count > 0 ? index % count : 0;
  const active = count > 0 ? featured[safeIndex] : undefined;

  const facts = useMemo(() => {
    if (!active) return null;
    return {
      kind: kindLabelFor(active.kind),
      where: jurisdictionFactFor(active.jurisdictionLabel) ?? 'Place withheld',
      era: eraFactFor(active),
      evidence: evidenceFactFor(active.claims),
      evidenceTier: evidenceTierFor(active.claims),
    };
  }, [active]);

  const mapHref = active ? mapHrefFor(active) : undefined;
  const sidebar = relatedTitles(featured, safeIndex);

  const anatomyPlace = useMemo((): RecordAnatomyPlace | undefined => {
    if (!active) return undefined;
    const anchor = active.geoAnchor ?? geoAnchorFor(active.id);
    if (!anchor) return undefined;
    const precision = active.locationPrecision ?? 'city';
    const tier = geoPrecisionTierForPublicPrecision(precision);
    return {
      lat: anchor.lat,
      lng: anchor.lng,
      label: active.displayName,
      precision,
      precisionCaption: radiusAffordanceLabel(tier, undefined),
    };
  }, [active]);

  const anatomyFacts = useMemo((): readonly RecordAnatomyFact[] => {
    if (!active || !facts) return [];
    return [
      {
        key: 'kind',
        label: 'Kind',
        value: facts.kind,
        icon: { variant: 'record-kind', kind: active.kind },
      },
      {
        key: 'where',
        label: 'Where',
        value: facts.where,
        icon: { variant: 'record-where' },
      },
      {
        key: 'era',
        label: 'Era',
        value: facts.era,
        icon: { variant: 'record-era' },
      },
      {
        key: 'evidence',
        label: 'Evidence',
        value: facts.evidence,
        icon: { variant: 'record-evidence', tier: facts.evidenceTier },
      },
    ];
  }, [active, facts]);

  const goTo = useCallback(
    (nextIndex: number) => {
      if (count === 0 || animating || nextIndex === safeIndex) return;
      setAnimating(true);
      window.setTimeout(() => {
        setIndex(nextIndex);
        setAnimating(false);
      }, 280);
    },
    [animating, count, safeIndex],
  );

  const step = useCallback(
    (delta: number) => {
      if (count === 0) return;
      const next =
        browseMode === 'random'
          ? pickRandomIndex({ current: safeIndex, total: count })
          : stepIndex(safeIndex, delta, count);
      goTo(next);
    },
    [browseMode, count, goTo, safeIndex],
  );

  useEffect(() => {
    if (safeIndex >= count && count > 0) {
      setIndex(0);
    }
  }, [count, safeIndex]);

  if (!active || !facts) {
    return (
      <section className="ds-home-edition__beat" id="beat-b" aria-labelledby="home-story-heading">
        <HomeEditionHeader
          index="02"
          kicker="One story"
          title="The grain of the archive."
          lede="One featured record with its anatomy visible: kind, place, era, evidence. Open it, or see it on the map where it belongs."
          id="home-story-heading"
        />
        <p className="ds-home-edition__empty">Featured records will appear when the release carries them.</p>
      </section>
    );
  }

  const slideClass = animating
    ? 'ds-home-edition__record-slide is-exiting'
    : 'ds-home-edition__record-slide';

  return (
    <section className="ds-home-edition__beat" id="beat-b" aria-labelledby="home-story-heading">
      <HomeEditionHeader
        index="02"
        kicker="One story"
        title="The grain of the archive."
        lede="One featured record with its anatomy visible: kind, place, era, evidence. Open it, or see it on the map where it belongs."
        id="home-story-heading"
      />

      <div className="ds-home-edition__record-panel">
        <div
          className="ds-home-edition__record-carousel"
          role="group"
          aria-roledescription="carousel"
          aria-label="Featured records"
        >
          <article className="ds-home-edition__record-card">
            <div className="ds-home-edition__record-toolbar">
              <RecordBrowseControls
                total={count}
                index={safeIndex}
                mode={browseMode}
                onModeChange={setBrowseMode}
                onPrevious={() => step(-1)}
                onNext={() => step(1)}
                onGoTo={goTo}
                itemIds={featured.map((entity) => entity.id)}
                ariaLabel="Featured records"
              />
            </div>

            <RecordAnatomyPanel
              facts={anatomyFacts}
              {...(anatomyPlace ? { place: anatomyPlace } : {})}
            />

            <div className="ds-home-edition__record-content">
              <div className={slideClass} key={active.id}>
                <p className="ds-home-edition__record-kind">Featured record · active release</p>
                <h3 className="ds-home-edition__record-name">{active.displayName}</h3>
                <p className="ds-home-edition__record-line">{active.summary}</p>
                <div className="ds-home-edition__record-actions">
                  <Link className="ds-cta ds-cta--copper" href={`/entity/${active.id}`}>
                    Open full record
                  </Link>
                  {mapHref ? (
                    <Link className="ds-cta ds-cta--quiet" href={mapHref}>
                      Show on map
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </article>
        </div>

        {sidebar.length > 0 ? (
          <aside className="ds-home-edition__record-sidebar">
            <div className="ds-home-edition__record-sidebar-block">
              <p className="ds-home-edition__record-sidebar-label">Also in this release</p>
              <ul className="ds-home-edition__record-sidebar-links">
                {sidebar.map(({ entity, index: entityIndex }) => (
                  <li key={entity.id}>
                    <button
                      type="button"
                      className="ds-home-edition__record-sidebar-link"
                      onClick={() => goTo(entityIndex)}
                    >
                      {entity.displayName}
                      <span>
                        {jurisdictionFactFor(entity.jurisdictionLabel) ?? 'Place withheld'} ·{' '}
                        {kindLabelFor(entity.kind)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
