/**
 * Living archive mosaic — B&W collage with soft, preloaded tile crossfades.
 *
 * Incoming images load before opacity flips so fades never flash empty cells.
 * Multiple cells may crossfade concurrently. When `entityLinks` is provided,
 * visible tiles that match a published record become keyboard-accessible links.
 * Static under prefers-reduced-motion, Save-Data, or a hidden document.
 */
'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { applyLivingTileSwap, pickLivingTileSwap } from './select-living-swap';
import { selectAtmospherePlane, type AtmosphereDensity } from './select-atmosphere-plane';
import { ATMOSPHERE_TILE_CREDITS, type AtmosphereTileCredit } from './tile-credits';
import './atmosphere.css';

void React;

/** How often we *start* a new soft swap (overlapping fades allowed). */
const DEFAULT_SWAP_INTERVAL_MS = 1600;
/** Must match CSS transition duration. */
const CROSSFADE_MS = 1800;

export type MosaicEntityLink = {
  readonly href: string;
  readonly label: string;
};

export type LivingAtmosphereMosaicProps = {
  readonly seedKey: string;
  readonly density?: AtmosphereDensity;
  /** Grid columns: story mast uses 8; about living mast prefers 8; compact rails use 4. */
  readonly columns?: 3 | 4 | 6 | 8;
  readonly swapIntervalMs?: number;
  readonly className?: string;
  /**
   * Published entity records keyed by entityId. When set, matching visible tiles
   * render as links to `/entity/[id]`; unmatched tiles stay non-interactive.
   */
  readonly entityLinks?: Readonly<Record<string, MosaicEntityLink>>;
};

type CellLayers = {
  readonly a: AtmosphereTileCredit;
  readonly b: AtmosphereTileCredit;
  /** When true, layer B is the visible face. */
  readonly showB: boolean;
  readonly fading: boolean;
};

function preloadImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.decoding = 'async';
    img.src = src;
  });
}

export function LivingAtmosphereMosaic({
  seedKey,
  density = 48,
  columns = 4,
  swapIntervalMs = DEFAULT_SWAP_INTERVAL_MS,
  className,
  entityLinks,
}: LivingAtmosphereMosaicProps) {
  const selection = selectAtmospherePlane({ seedKey, density });
  const [mosaicFailed, setMosaicFailed] = useState(false);
  const [preferStatic, setPreferStatic] = useState(false);
  const [cells, setCells] = useState<readonly CellLayers[]>(() =>
    selection.tiles.map((tile) => ({ a: tile, b: tile, showB: false, fading: false })),
  );
  const visibleRef = useRef<readonly AtmosphereTileCredit[]>(selection.tiles);
  const cellsRef = useRef(cells);
  const tickRef = useRef(0);
  const busySlotsRef = useRef<Set<number>>(new Set());
  const interactive = Boolean(entityLinks && Object.keys(entityLinks).length > 0);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData =
      typeof navigator !== 'undefined' &&
      'connection' in navigator &&
      Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
      );
    if (reducedMotion || saveData) {
      setPreferStatic(true);
    }
  }, []);

  useEffect(() => {
    visibleRef.current = cells.map((cell) => (cell.showB ? cell.b : cell.a));
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

    let cancelled = false;

    const runSwap = async () => {
      if (cancelled || document.visibilityState === 'hidden') return;

      tickRef.current += 1;
      const swap = pickLivingTileSwap(
        visibleRef.current,
        ATMOSPHERE_TILE_CREDITS,
        seedKey,
        tickRef.current,
      );
      if (!swap) return;
      if (busySlotsRef.current.has(swap.slot)) return;

      const ok = await preloadImage(swap.tile.path);
      if (cancelled || !ok) {
        if (!ok) setMosaicFailed(true);
        return;
      }
      if (busySlotsRef.current.has(swap.slot)) return;

      busySlotsRef.current.add(swap.slot);
      const current = cellsRef.current[swap.slot];
      if (!current) {
        busySlotsRef.current.delete(swap.slot);
        return;
      }

      setCells((prev) => {
        const next = prev.slice();
        const cell = next[swap.slot];
        if (!cell) return prev;
        if (cell.showB) {
          next[swap.slot] = { a: swap.tile, b: cell.b, showB: false, fading: true };
        } else {
          next[swap.slot] = { a: cell.a, b: swap.tile, showB: true, fading: true };
        }
        return next;
      });
      visibleRef.current = applyLivingTileSwap(visibleRef.current, swap);

      window.setTimeout(() => {
        busySlotsRef.current.delete(swap.slot);
        if (cancelled) return;
        setCells((prev) => {
          const next = prev.slice();
          const cell = next[swap.slot];
          if (!cell) return prev;
          next[swap.slot] = { ...cell, fading: false };
          return next;
        });
      }, CROSSFADE_MS + 40);
    };

    const intervalId = window.setInterval(() => {
      void runSwap();
    }, swapIntervalMs);

    const kickId = window.setTimeout(() => {
      void runSwap();
    }, 900);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(kickId);
    };
  }, [preferStatic, mosaicFailed, selection.mode, selection.tiles.length, seedKey, swapIntervalMs]);

  const showLive =
    selection.mode === 'mosaic' && selection.tiles.length > 0 && !mosaicFailed && !preferStatic;

  const renderCells: readonly CellLayers[] = showLive
    ? cells
    : selection.tiles.map((tile) => ({ a: tile, b: tile, showB: false, fading: false }));

  const showMosaic = (showLive || preferStatic) && selection.tiles.length > 0 && !mosaicFailed;

  const rootClass = [
    'ds-atmosphere',
    'ds-atmosphere--living',
    interactive ? 'ds-atmosphere--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      aria-hidden={interactive ? undefined : true}
      data-plane-id={selection.planeId}
      data-columns={columns}
      style={{ ['--ds-atmosphere-columns' as string]: String(columns) }}
    >
      <div
        className="ds-atmosphere__geometric"
        style={{ backgroundImage: `url(${selection.geometric.path})` }}
        aria-hidden="true"
      />
      {showMosaic ? (
        <div
          className="ds-atmosphere__mosaic ds-atmosphere__mosaic--living"
          role={interactive ? 'list' : undefined}
          aria-label={interactive ? 'Archive mosaic — open a record' : undefined}
        >
          {renderCells.map((cell, index) => {
            const visible = cell.showB ? cell.b : cell.a;
            const link = entityLinks?.[visible.entityId];
            const cellClass = [
              'ds-atmosphere__cell',
              cell.fading ? 'ds-atmosphere__cell--fading' : '',
              link ? 'ds-atmosphere__cell--link' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const layers = (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative mosaic layers; fail-closed via onError */}
                <img
                  className={[
                    'ds-atmosphere__tile',
                    'ds-atmosphere__tile-layer',
                    cell.showB
                      ? 'ds-atmosphere__tile-layer--under'
                      : 'ds-atmosphere__tile-layer--over',
                  ].join(' ')}
                  src={cell.a.path}
                  alt=""
                  width={96}
                  height={120}
                  decoding="async"
                  loading={index < 8 ? 'eager' : 'lazy'}
                  onError={() => setMosaicFailed(true)}
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative mosaic layers; fail-closed via onError */}
                <img
                  className={[
                    'ds-atmosphere__tile',
                    'ds-atmosphere__tile-layer',
                    cell.showB
                      ? 'ds-atmosphere__tile-layer--over'
                      : 'ds-atmosphere__tile-layer--under',
                  ].join(' ')}
                  src={cell.b.path}
                  alt=""
                  width={96}
                  height={120}
                  decoding="async"
                  loading="lazy"
                  onError={() => setMosaicFailed(true)}
                />
              </>
            );

            if (link) {
              return (
                <Link
                  key={`cell-${index}`}
                  href={link.href}
                  className={cellClass}
                  role={interactive ? 'listitem' : undefined}
                  aria-label={`Open record: ${link.label}`}
                >
                  {layers}
                </Link>
              );
            }

            return (
              <div
                key={`cell-${index}`}
                className={cellClass}
                role={interactive ? 'listitem' : undefined}
                aria-hidden={interactive ? true : undefined}
              >
                {layers}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
