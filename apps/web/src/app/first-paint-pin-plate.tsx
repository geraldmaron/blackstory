/**
 * Server-rendered pin plate for Explore's first paint: the national field a reader sees before
 * the live plate stamps `data-plate-ready`, and the field a reader without JavaScript or WebGL
 * keeps.
 *
 * It is the plate's own picture (repo-27uao). Pins are projected in Web Mercator onto the CONUS
 * board the plate opens on (`conus-mercator.ts`) and grouped with MapLibre's own clustering
 * (`first-paint-clusters.ts`) for each tile zoom the opening frame can land in; the stylesheet
 * shows one pattern or the other from the viewport size, the way the plate picks its tile zoom.
 * So at the handoff every disc is already where the plate will paint it, and the reveal is a
 * crossfade between two identical maps. Copper marks holding walks, which are also the plate's
 * only links; every other single disc is still a hit target that opens the record sheet through
 * the underlay gestures once hydrated.
 *
 * `/` no longer mounts this (repo-18ma2): the Door's only map is the live plate.
 */
import React from 'react';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import { conusPinPercent } from '../lib/map-experience/conus-mercator';
import { isFirstPaintWalk, isShopToken } from '../lib/map-experience/first-paint-pins';
import {
  FIRST_PAINT_CLUSTER_ZOOMS,
  firstPaintClusterTier,
  groupFirstPaintPins,
} from '../lib/map-experience/first-paint-clusters';
import './first-paint-pin-plate.css';

void React;

type FirstPaintPinPlateProps = {
  readonly pins: ExploreMapFeatureCollection;
};

function pinAriaLabel(name: string): string {
  if (isShopToken(name) || name.trim().length === 0) return 'Open this place';
  return `Open ${name}`;
}

export function FirstPaintPinPlate({ pins }: FirstPaintPinPlateProps) {
  const projected = pins.features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    return conusPinPercent(lng, lat);
  });
  /*
   * The plate's clusters, at both tile zooms the opening frame lands in. Every pin stays in the
   * DOM in index order — `firstPaintPinId` is index-aligned — and a grouped pin is only hidden,
   * per zoom, by the stylesheet.
   */
  const points = pins.features.map((feature, index) => {
    if (!projected[index]) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return { lng, lat };
  });
  const groupings = FIRST_PAINT_CLUSTER_ZOOMS.map((zoom) => ({
    zoom,
    ...groupFirstPaintPins(points, zoom),
  }));

  return (
    <div className="ds-first-paint-plate" aria-label="Documented places">
      {pins.features.map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const projectedPin = projected[index];
        if (!projectedPin) return null;
        const style = {
          left: `${projectedPin.x.toFixed(4)}%`,
          top: `${projectedPin.y.toFixed(4)}%`,
        };
        const walk = isFirstPaintWalk(feature);
        const href = feature.properties.href;
        const canLink = Boolean(href) && walk;
        const className = [
          'ds-first-paint-pin',
          walk ? 'ds-first-paint-pin--walk' : '',
          canLink ? 'ds-first-paint-pin--link' : '',
          ...groupings.map(({ zoom, grouped }) =>
            grouped.has(index) ? `ds-first-paint-pin--in-z${zoom}` : '',
          ),
        ]
          .filter(Boolean)
          .join(' ');

        if (canLink && href) {
          return (
            <a
              key={feature.properties.entityId || `pin-${index}`}
              className={className}
              href={href}
              aria-label={pinAriaLabel(feature.properties.displayName)}
              style={style}
              data-entity-id={feature.properties.entityId}
              data-lng={lng}
              data-lat={lat}
            />
          );
        }

        return (
          <span
            key={feature.properties.entityId || `pin-${index}`}
            className={className}
            aria-hidden="true"
            style={style}
            data-entity-id={feature.properties.entityId}
            data-lng={lng}
            data-lat={lat}
          />
        );
      })}
      {groupings.flatMap(({ zoom, clusters }) =>
        clusters.map((cluster) => {
          const point = conusPinPercent(cluster.lng, cluster.lat);
          if (!point) return null;
          return (
            <span
              key={`cluster-z${zoom}-${point.x}-${point.y}`}
              className="ds-first-paint-cluster"
              data-zoom={zoom}
              data-tier={firstPaintClusterTier(cluster.count)}
              aria-hidden="true"
              style={{ left: `${point.x.toFixed(4)}%`, top: `${point.y.toFixed(4)}%` }}
            >
              {cluster.count}
            </span>
          );
        }),
      )}
    </div>
  );
}
