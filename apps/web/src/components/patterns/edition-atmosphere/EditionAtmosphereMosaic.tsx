/**
 * Shared edition gutter mosaic — rights-cleared archive tile pool with deterministic
 * polaroid scatter in left/right gutters. Used on home and v6 edition surfaces (atmosphere only).
 */
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { EDITION_MOSAIC_COUNT_DEFAULT } from './edition-atmosphere-config';
import { computeScatteredMosaicLayout } from './compute-scattered-mosaic-layout';

export type EditionAtmosphereMosaicProps = {
  readonly seedKey: string;
  readonly count?: number;
};

export function EditionAtmosphereMosaic({
  seedKey,
  count = EDITION_MOSAIC_COUNT_DEFAULT,
}: EditionAtmosphereMosaicProps) {
  const [failedPlacementIndexes, setFailedPlacementIndexes] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const placements = useMemo(
    () => computeScatteredMosaicLayout({ seedKey, count }),
    [seedKey, count],
  );

  const markPlacementFailed = useCallback((placementIndex: number) => {
    setFailedPlacementIndexes((current) => {
      if (current.has(placementIndex)) {
        return current;
      }
      const next = new Set(current);
      next.add(placementIndex);
      return next;
    });
  }, []);

  const visiblePlacements = placements.filter(
    (placement) => !failedPlacementIndexes.has(placement.placementIndex),
  );

  if (visiblePlacements.length === 0) {
    return <div className="ds-edition-atmosphere" aria-hidden="true" />;
  }

  return (
    <div className="ds-edition-atmosphere" aria-hidden="true">
      <div className="ds-edition-atmosphere__mosaic">
        {visiblePlacements.map((placement) => (
          <figure
            key={`${seedKey}-${placement.placementIndex}`}
            className="ds-edition-atmosphere__polaroid"
            data-side={placement.side}
            style={{
              ['--ds-edition-tile-x' as string]: placement.gutterX,
              ['--ds-edition-tile-y' as string]: placement.gutterY,
              ['--ds-edition-tile-width' as string]: `${placement.widthRem}rem`,
              ['--ds-edition-tile-height' as string]: `${placement.heightRem}rem`,
              ['--ds-edition-tile-rot' as string]: `${placement.rotationDeg}deg`,
              ['--ds-edition-tile-opacity' as string]: String(placement.opacity),
              ['--ds-edition-tile-object-position' as string]: placement.objectPosition,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative mosaic; fail-closed via onError */}
            <img
              className="ds-edition-atmosphere__polaroid-photo"
              src={placement.tile.path}
              alt=""
              decoding="async"
              loading="lazy"
              draggable={false}
              onError={() => markPlacementFailed(placement.placementIndex)}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
