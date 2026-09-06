/**
 * Server-rendered pin plate for Explore's first paint: the national field a reader sees before
 * the live plate stamps `data-plate-ready`, and the field a reader without JavaScript or WebGL
 * keeps. Copper marks holding walks, which are also the plate's only links; every other disc is
 * still a hit target that opens the record sheet through the locator gestures once hydrated.
 *
 * `/` no longer mounts this (repo-18ma2): the Door's only map is the live plate.
 */
import React from 'react';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import { locatorPinPercent } from '../lib/map-experience/albers-usa';
import { isFirstPaintWalk, isShopToken } from '../lib/map-experience/first-paint-pins';
import {
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
  /*
   * Group the board the way the live plate groups the national frame (first-paint-clusters.ts),
   * so the handoff is one pattern settling rather than 4,101 loose discs replaced by copper
   * count discs. Every pin stays in the DOM in index order — `firstPaintPinId` is index-aligned —
   * a grouped pin is only hidden. Walks stay single, as they read on the plate.
   */
  const projected = pins.features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    return locatorPinPercent(lng, lat);
  });
  const exclude = new Set<number>();
  pins.features.forEach((feature, index) => {
    if (isFirstPaintWalk(feature)) exclude.add(index);
  });
  const grouping = groupFirstPaintPins(projected, { exclude });

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
        const grouped = grouping.grouped.has(index);
        const className = [
          'ds-first-paint-pin',
          walk ? 'ds-first-paint-pin--walk' : '',
          canLink ? 'ds-first-paint-pin--link' : '',
          grouped ? 'ds-first-paint-pin--grouped' : '',
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
      {grouping.clusters.map((cluster) => (
        <span
          key={`cluster-${cluster.x}-${cluster.y}`}
          className="ds-first-paint-cluster"
          data-tier={firstPaintClusterTier(cluster.count)}
          aria-hidden="true"
          style={{ left: `${cluster.x.toFixed(4)}%`, top: `${cluster.y.toFixed(4)}%` }}
        >
          {cluster.count}
        </span>
      ))}
    </div>
  );
}
