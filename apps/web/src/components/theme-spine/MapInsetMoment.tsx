/**
 * Theme-spine "map inset" moment: a small static map panel pinned to a chapter's place,
 * with a copperPin marker, linking into the full map experience with the entity selected.
 *
 * Reuses the existing hero/entity map machinery instead of forking it:
 *  - `EntityLocationMap` (apps/web/src/components/entity/EntityLocationMap.tsx) already
 *    renders exactly this shape — an OpenFreeMap panel centered on a public-precision
 *    coordinate with a copper pin — built on `entity-location-map-style.ts` and this
 *    codebase's `dignity-style.ts` palette (the same color tokens `hero-map-inset.ts`'s
 *    MapStage plate draws from). `hero-map-inset.ts` itself only positions the persistent
 *    full-bleed home-hero MapStage plate against scroll geometry, which doesn't apply to a
 *    small inline panel, so this component calls into `EntityLocationMap` rather than that
 *    module.
 *  - The "view on map" link reuses `buildExploreHref`/`defaultExploreOverlayState` from
 *    `lib/map-experience/url-state.ts` — the same `selected=<entityId>` convention used by
 *    entity and story pages ("View on map" CTAs) to pre-select an entity on `/explore`.
 *
 * Static and reduced-motion safe: `selected`/`locked` are left at their default (false), so
 * `EntityLocationMap` never engages its selection-pulse animation here.
 */
import React from 'react';
import Link from 'next/link';
import { EntityLocationMap } from '../entity/EntityLocationMap';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import {
  buildExploreHref,
  defaultExploreOverlayState,
} from '../../lib/map-experience/url-state';

void React;

export type MapInsetMomentProps = {
  readonly entityId: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: 'county' | 'city' | 'neighborhood' | 'campus' | 'institution';
  readonly className?: string;
};

export function MapInsetMoment({
  entityId,
  label,
  lat,
  lng,
  precision,
  className,
}: MapInsetMomentProps) {
  const rootClassName = ['ds-map-inset-moment', className].filter(Boolean).join(' ');
  const exploreHref = buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    selected: entityId,
  });

  return (
    <figure className={rootClassName}>
      <div className="ds-map-inset-moment__frame">
        <EntityLocationMap lat={lat} lng={lng} label={label} precision={precision} />
      </div>
      <figcaption className="ds-map-inset-moment__caption">
        <span className="ds-map-inset-moment__place">{label}</span>
        <Link className="ds-map-inset-moment__link" href={exploreHref}>
          View on map
        </Link>
      </figcaption>
    </figure>
  );
}
