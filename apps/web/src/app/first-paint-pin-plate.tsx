/**
 * Server-rendered first-paint pin plate for `/`. Every geo pin is a disc on
 * the national frame. Only a holding `/place/` walk is a link. A pin without
 * a holding page is not a link. Shop tokens never title a pin.
 *
 * This is the plate Verity scores, not a typed list of five `/place/` URLs.
 * Binding: `docs/ui/patterns-atlas-instrument.md` and the existing
 * `.ds-map-entity-marker` language. Door-specific layout, not a new mark.
 */
import React from 'react';
import type { ExploreMapFeatureCollection } from '../lib/map-experience/build-explore-map-source';
import {
  conusPinPercent,
  isFirstPaintWalk,
  isShopToken,
} from '../lib/map-experience/first-paint-pins';
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
  return (
    <div className="ds-first-paint-plate" aria-label="Documented places">
      {pins.features.map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        const { left, top } = conusPinPercent(lng, lat);
        const walk = isFirstPaintWalk(feature);
        const style = { left: `${left}%`, top: `${top}%` };
        const className = walk
          ? 'ds-map-entity-marker ds-first-paint-pin ds-first-paint-pin--walk'
          : 'ds-map-entity-marker ds-first-paint-pin';
        if (walk) {
          return (
            <a
              key={feature.properties.entityId || `pin-${index}`}
              className={className}
              href={feature.properties.href}
              aria-label={pinAriaLabel(feature.properties.displayName)}
              style={style}
            />
          );
        }
        return (
          <span
            key={feature.properties.entityId || `pin-${index}`}
            className={className}
            aria-hidden="true"
            style={style}
          />
        );
      })}
    </div>
  );
}
