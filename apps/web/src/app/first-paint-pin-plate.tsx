/**
 * Server-rendered pin plate for `/` and Explore first paint. On the Door Journey every
 * record with a public href is a link; copper still marks holding walks. A focus entity
 * (chapter spotlight) enlarges for the active camera frame.
 */
import React from 'react';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import { locatorPinPercent } from '../lib/map-experience/albers-usa';
import { isPinPlateWalk, isShopToken } from '../lib/map-experience/first-paint-pins';
import {
  firstPaintClusterTier,
  groupFirstPaintPins,
} from '../lib/map-experience/first-paint-clusters';
import './first-paint-pin-plate.css';

void React;

type FirstPaintPinPlateProps = {
  readonly pins: ExploreMapFeatureCollection;
  /**
   * Door Journey: every pin with a public href is a link. Explore first paint
   * keeps walks-only as hrefs (no-JS); every disc is still a hit target that
   * opens the record sheet via the locator gestures.
   */
  readonly linkRecords?: boolean;
  /** Chapter focus — evidence spotlight or similar. */
  readonly focusEntityId?: string | null;
  /** Optional modifier for responsive Door plates (full vs mobile-thinned). */
  readonly plateClassName?: string;
};

/** Shared with `pinAriaLabel` below and read back out by `use-pin-photo-hover.ts` — deriving a
 * hover card's display name from the pin's own accessible name costs no extra bytes on the Door's
 * ISR page, where a second `data-*` attribute repeating the same text would. */
export const PIN_ARIA_LABEL_PREFIX = 'Open ';

function pinAriaLabel(name: string): string {
  if (isShopToken(name) || name.trim().length === 0) return 'Open this place';
  return `${PIN_ARIA_LABEL_PREFIX}${name}`;
}

export function FirstPaintPinPlate({
  pins,
  linkRecords = false,
  focusEntityId = null,
  plateClassName,
}: FirstPaintPinPlateProps) {
  const plateClasses = [
    'ds-first-paint-plate',
    linkRecords ? 'ds-first-paint-plate--records' : '',
    plateClassName ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  /*
   * Group the board the way the live plate groups the national frame (first-paint-clusters.ts),
   * so the handoff is one pattern settling rather than 4,101 loose discs replaced by copper
   * count discs. Every pin stays in the DOM in index order — `firstPaintPinId` and the Door photo
   * index are index-aligned — a grouped pin is only hidden. Walks and the focus record stay
   * single, as they read on the plate.
   */
  const projected = pins.features.map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    return locatorPinPercent(lng, lat);
  });
  const exclude = new Set<number>();
  pins.features.forEach((feature, index) => {
    if (isPinPlateWalk(feature, linkRecords)) exclude.add(index);
    if (
      focusEntityId !== null &&
      focusEntityId.length > 0 &&
      feature.properties.entityId === focusEntityId
    ) {
      exclude.add(index);
    }
  });
  const grouping = groupFirstPaintPins(projected, { exclude });

  return (
    <div className={plateClasses} aria-label="Documented places">
      {pins.features.map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const projectedPin = projected[index];
        if (!projectedPin) return null;
        const style = {
          left: `${projectedPin.x.toFixed(4)}%`,
          top: `${projectedPin.y.toFixed(4)}%`,
        };
        const walk = isPinPlateWalk(feature, linkRecords);
        const focused =
          focusEntityId !== null &&
          focusEntityId.length > 0 &&
          feature.properties.entityId === focusEntityId;
        const href = feature.properties.href;
        const canLink = Boolean(href) && (linkRecords || walk);
        const grouped = grouping.grouped.has(index);
        const className = [
          'ds-first-paint-pin',
          walk ? 'ds-first-paint-pin--walk' : '',
          focused ? 'ds-first-paint-pin--focus' : '',
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
              aria-current={focused ? 'true' : undefined}
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
