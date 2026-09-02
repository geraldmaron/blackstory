/**
 * Door place mosaic: a static grid of real place records under the journey chapters.
 * Server-rendered only — no client JS, no WebGL, no second catalog fetch. Tiles come from
 * `selectDoorMosaicTiles`, which already has the pin plate and the raw catalog features
 * `door-home.tsx` loaded for the journey itself.
 */
import React from 'react';
import Link from 'next/link';
import { KindGlyph } from '../components/map-experience/KindGlyph';
import type { DoorMosaicTile } from '../lib/map-experience/door-place-mosaic';
import './door-place-mosaic.css';

void React;

export type DoorPlaceMosaicProps = {
  readonly tiles: readonly DoorMosaicTile[];
};

export function DoorPlaceMosaic({ tiles }: DoorPlaceMosaicProps) {
  if (tiles.length === 0) return null;

  return (
    <section className="ds-door-mosaic" aria-labelledby="door-mosaic-heading" data-motion="calm">
      <h2 id="door-mosaic-heading" className="ds-door-mosaic__heading">
        Places on the record
      </h2>
      <ul className="ds-door-mosaic__grid">
        {tiles.map((tile) => (
          <li key={tile.key} className="ds-door-mosaic__tile">
            <Link href={tile.href} className="ds-door-mosaic__link">
              <span className="ds-door-mosaic__mark" aria-hidden="true">
                <KindGlyph
                  kind={tile.kind}
                  size={18}
                  {...(tile.mapTone !== undefined ? { mapTone: tile.mapTone } : {})}
                />
              </span>
              <span className="ds-door-mosaic__name">{tile.displayName}</span>
              {tile.stateLabel || tile.decadeLabel ? (
                <span className="ds-door-mosaic__meta ds-mono">
                  {[tile.stateLabel, tile.decadeLabel].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
