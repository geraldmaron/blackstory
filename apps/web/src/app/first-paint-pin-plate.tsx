/**
 * Server-rendered pin plate for `/` and Explore first paint. On the Door Journey every
 * record with a public href is a link; copper still marks holding walks. A focus entity
 * (chapter spotlight) enlarges for the active camera frame.
 */
import React from 'react';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import { locatorPinPercent } from '../lib/map-experience/albers-usa';
import { isPinPlateWalk, isShopToken } from '../lib/map-experience/first-paint-pins';
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

  return (
    <div className={plateClasses} aria-label="Documented places">
      {pins.features.map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const projected = locatorPinPercent(lng, lat);
        if (!projected) return null;
        const style = {
          left: `${projected.x.toFixed(4)}%`,
          top: `${projected.y.toFixed(4)}%`,
        };
        const walk = isPinPlateWalk(feature, linkRecords);
        const focused =
          focusEntityId !== null &&
          focusEntityId.length > 0 &&
          feature.properties.entityId === focusEntityId;
        const href = feature.properties.href;
        const canLink = Boolean(href) && (linkRecords || walk);
        const className = [
          'ds-first-paint-pin',
          walk ? 'ds-first-paint-pin--walk' : '',
          focused ? 'ds-first-paint-pin--focus' : '',
          canLink ? 'ds-first-paint-pin--link' : '',
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
    </div>
  );
}
