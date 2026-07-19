/**
 * Living archive mosaic — same B&W collage language as story AtmospherePlane,
 * with individual tiles swapping in/out from the broader pool.
 *
 * Opacity crossfade only (no scale/glow). Static under prefers-reduced-motion,
 * Save-Data, or when the document is hidden. Plane is aria-hidden; attribution
 * lives in adjacent copy.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  applyLivingTileSwap,
  pickLivingTileSwap,
} from './select-living-swap';
import {
  selectAtmospherePlane,
  type AtmosphereDensity,
} from './select-atmosphere-plane';
import { ATMOSPHERE_TILE_CREDITS, type AtmosphereTileCredit } from './tile-credits';
import './atmosphere.css';

void React;

const DEFAULT_SWAP_INTERVAL_MS = 3200;
const CROSSFADE_MS = 700;

export type LivingAtmosphereMosaicProps = {
  readonly seedKey: string;
  readonly density?: AtmosphereDensity;
  /** Grid columns for the rail (story mast uses 8; about rail prefers 4). */
  readonly columns?: 3 | 4;
  readonly swapIntervalMs?: number;
  readonly className?: string;
};

type CellLayers = {
  readonly front: AtmosphereTileCredit;
  readonly back: AtmosphereTileCredit | null;
  readonly showBack: boolean;
};

export function LivingAtmosphereMosaic({
  seedKey,
  density = 16,
  columns = 4,
  swapIntervalMs = DEFAULT_SWAP_INTERVAL_MS,
  className,
}: LivingAtmosphereMosaicProps) {
  const selection = selectAtmospherePlane({ seedKey, density });
  const [mosaicFailed, setMosaicFailed] = useState(false);
  const [preferStatic, setPreferStatic] = useState(false);
  const [cells, setCells] = useState<readonly CellLayers[]>(() =>
    selection.tiles.map((tile) => ({ front: tile, back: null, showBack: false })),
  );
  const visibleRef = useRef<readonly AtmosphereTileCredit[]>(selection.tiles);
  const tickRef = useRef(0);
  const fadingRef = useRef(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData =
      typeof navigator !== 'undefined' &&
      'connection' in navigator &&
      Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
          ?.saveData,
      );
    if (reducedMotion || saveData) {
      setPreferStatic(true);
    }
  }, []);

  useEffect(() => {
    visibleRef.current = cells.map((cell) => (cell.showBack && cell.back ? cell.back : cell.front));
  }, [cells]);

  useEffect(() => {
    if (
      preferStatic ||
      mosaicFailed ||
      selection.mode !== 'mosaic' ||
      selection.tiles.length === 0
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || fadingRef.current) return;

      tickRef.current += 1;
      const swap = pickLivingTileSwap(
        visibleRef.current,
        ATMOSPHERE_TILE_CREDITS,
        seedKey,
        tickRef.current,
      );
      if (!swap) return;

      fadingRef.current = true;
      setCells((prev) => {
        const next = prev.slice();
        const current = next[swap.slot];
        if (!current) return prev;
        // Incoming tile lands on the hidden layer, then we flip showBack.
        if (current.showBack) {
          next[swap.slot] = { front: swap.tile, back: current.back, showBack: false };
        } else {
          next[swap.slot] = { front: current.front, back: swap.tile, showBack: true };
        }
        return next;
      });
      visibleRef.current = applyLivingTileSwap(visibleRef.current, swap);

      window.setTimeout(() => {
        fadingRef.current = false;
      }, CROSSFADE_MS + 50);
    }, swapIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [preferStatic, mosaicFailed, selection.mode, selection.tiles.length, seedKey, swapIntervalMs]);

  const showMosaic =
    selection.mode === 'mosaic' &&
    selection.tiles.length > 0 &&
    !mosaicFailed &&
    !preferStatic;

  const rootClass = ['ds-atmosphere', 'ds-atmosphere--living', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      aria-hidden="true"
      data-plane-id={selection.planeId}
      data-columns={columns}
      style={{ ['--ds-atmosphere-columns' as string]: String(columns) }}
    >
      <div
        className="ds-atmosphere__geometric"
        style={{ backgroundImage: `url(${selection.geometric.path})` }}
      />
      {showMosaic ? (
        <div className="ds-atmosphere__mosaic ds-atmosphere__mosaic--living">
          {cells.map((cell, index) => (
            <div key={`cell-${index}`} className="ds-atmosphere__cell">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative mosaic; fail-closed via onError */}
              <img
                className={[
                  'ds-atmosphere__tile',
                  'ds-atmosphere__tile-layer',
                  cell.showBack ? 'ds-atmosphere__tile-layer--under' : 'ds-atmosphere__tile-layer--over',
                ].join(' ')}
                src={cell.front.path}
                alt=""
                width={96}
                height={120}
                decoding="async"
                loading={index < 4 ? 'eager' : 'lazy'}
                onError={() => setMosaicFailed(true)}
              />
              {cell.back ? (
                // eslint-disable-next-line @next/next/no-img-element -- decorative mosaic; fail-closed via onError
                <img
                  className={[
                    'ds-atmosphere__tile',
                    'ds-atmosphere__tile-layer',
                    cell.showBack ? 'ds-atmosphere__tile-layer--over' : 'ds-atmosphere__tile-layer--under',
                  ].join(' ')}
                  src={cell.back.path}
                  alt=""
                  width={96}
                  height={120}
                  decoding="async"
                  loading="lazy"
                  onError={() => setMosaicFailed(true)}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : preferStatic && selection.tiles.length > 0 && !mosaicFailed ? (
        <div className="ds-atmosphere__mosaic ds-atmosphere__mosaic--living">
          {selection.tiles.map((tile, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- decorative mosaic; fail-closed via onError
            <img
              key={`${tile.path}-${index}`}
              className="ds-atmosphere__tile"
              src={tile.path}
              alt=""
              width={96}
              height={120}
              decoding="async"
              loading={index < 4 ? 'eager' : 'lazy'}
              onError={() => setMosaicFailed(true)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
