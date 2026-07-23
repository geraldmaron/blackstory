/**
 * Shared edition gutter mosaic — rights-cleared archive tile pool with deterministic
 * scattered placement. Used on home, about, and stories v6 editions (atmosphere only).
 */
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { computeScatteredMosaicLayout } from './compute-scattered-mosaic-layout';

export type EditionAtmosphereMosaicProps = {
  readonly seedKey: string;
  readonly count?: number;
};

export function EditionAtmosphereMosaic({ seedKey, count = 16 }: EditionAtmosphereMosaicProps) {
  const [failedPaths, setFailedPaths] = useState<ReadonlySet<string>>(() => new Set());
  const placements = useMemo(
    () => computeScatteredMosaicLayout({ seedKey, count }),
    [seedKey, count],
  );

  const markTileFailed = useCallback((path: string) => {
    setFailedPaths((current) => {
      if (current.has(path)) {
        return current;
      }
      const next = new Set(current);
      next.add(path);
      return next;
    });
  }, []);

  const visiblePlacements = placements.filter((placement) => !failedPaths.has(placement.tile.path));

  if (visiblePlacements.length === 0) {
    return <div className="ds-edition-atmosphere" aria-hidden="true" />;
  }

  return (
    <div className="ds-edition-atmosphere" aria-hidden="true">
      <div className="ds-edition-atmosphere__mosaic">
        {visiblePlacements.map((placement) => (
          // eslint-disable-next-line @next/next/no-img-element -- decorative mosaic; fail-closed via onError
          <img
            key={`${placement.tile.path}-${placement.side}-${placement.gutterX}`}
            className="ds-edition-atmosphere__tile"
            data-side={placement.side}
            src={placement.tile.path}
            alt=""
            decoding="async"
            loading="lazy"
            draggable={false}
            onError={() => markTileFailed(placement.tile.path)}
            style={{
              ['--ds-edition-tile-x' as string]: placement.gutterX,
              ['--ds-edition-tile-y' as string]: placement.gutterY,
              ['--ds-edition-tile-size' as string]: `${placement.sizeRem}rem`,
              ['--ds-edition-tile-rot' as string]: `${placement.rotationDeg}deg`,
              ['--ds-edition-tile-opacity' as string]: String(placement.opacity),
            }}
          />
        ))}
      </div>
    </div>
  );
}
