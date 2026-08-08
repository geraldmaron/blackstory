/**
 * A chapter's `mapInset` block, rendered as the room kit's map moment.
 *
 * WHAT CHANGED AND WHY (SP-08, repo-92n2.8). This used to mount `EntityLocationMap`, a second
 * MapLibre instance inside the article column. That cost a whole extra GL context per chapter that
 * happened to cite a place, and it put a live, independently-styled map behind prose — the thing
 * the plate postures exist to forbid. It now contributes a SLOT and a caption, and the one
 * persistent plate moves into that slot when the block scrolls into view.
 *
 * This is where the Framed posture first runs for real: chapter detail is a Reading surface, so
 * the plate rests Parked and is borrowed only while a moment is live. Between moments, and for a
 * reader with no JavaScript, the caption still carries the point.
 *
 * The component survives as a thin adapter rather than the article rendering `MapMoment` directly,
 * because the `mapInset` block carries an `entityId` and the Atlas hand-off has to be built from
 * it — `selected=<entityId>` is the same convention entity and story pages use. That is real
 * mapping logic and it belongs somewhere; a wrapper this size is cheaper than teaching `ArticleBody`
 * the explore URL vocabulary.
 */
import React from 'react';
import { MapMoment } from '../room';
import { DEFAULT_EXPLORE_FILTERS } from '../../lib/map-experience/filters';
import { zoomForLocationPrecision } from '../../lib/map-experience/geo-precision';
import { buildExploreHref, defaultExploreOverlayState } from '../../lib/map-experience/url-state';

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
  const exploreHref = buildExploreHref({
    filters: DEFAULT_EXPLORE_FILTERS,
    ...defaultExploreOverlayState(),
    selected: entityId,
  });

  return (
    <MapMoment
      // No pitch and no bearing. A chapter's place inset is a locator, not a cinematic: the
      // camera arrives level, and `resolveMomentCamera` still drops both under reduced motion.
      camera={{ center: [lng, lat], zoom: zoomForLocationPrecision(precision) }}
      note={label}
      atlasHref={exploreHref}
      {...(className ? { className } : {})}
    />
  );
}
