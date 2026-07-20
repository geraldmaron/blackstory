/**
 * Living archive mosaic — B&W collage with soft, preloaded tile crossfades.
 *
 * When `fillContainer` is set, columns/rows/density are derived from the plane
 * size so every cell stays fully visible (no mid-face mast clipping) and larger
 * screens receive more tiles. Incoming images preload before opacity flips.
 */
'use client';

import Link from 'next/link';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { computeFillMosaicLayout } from './compute-fill-mosaic-layout';
import { applyLivingTileSwap, pickLivingTileSwap } from './select-living-swap';
import {
  selectAtmospherePlane,
  selectMosaicTiles,
  type AtmosphereDensity,
} from './select-atmosphere-plane';
import { ATMOSPHERE_TILE_CREDITS, type AtmosphereTileCredit } from './tile-credits';
import './atmosphere.css';

void React;

const DEFAULT_SWAP_INTERVAL_MS = 1600;
const CROSSFADE_MS = 1800;

export type MosaicEntityLink = {
  readonly href: string;
  readonly label: string;
};

export type LivingAtmosphereMosaicProps = {
  readonly seedKey: string;
  readonly density?: AtmosphereDensity | number;
  readonly columns?: 3 | 4 | 6 | 8 | 10 | 12;
  readonly swapIntervalMs?: number;
  readonly className?: string;
  /**
   * Size the grid from the plane’s box: complete rows only, denser on larger
   * viewports. Overrides fixed density/columns while active.
   */
  readonly fillContainer?: boolean;
  readonly entityLinks?: Readonly<Record<string, MosaicEntityLink>>;
};

type CellLayers = {
  readonly a: AtmosphereTileCredit;
  readonly b: AtmosphereTileCredit;
  readonly showB: boolean;
  readonly fading: boolean;
};

type LayoutState = {
  readonly columns: number;
  readonly rows: number;
  readonly density: number;
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

function cellsFromTiles(tiles: readonly AtmosphereTileCredit[]): CellLayers[] {
  return tiles.map((tile) => ({ a: tile, b: tile, showB: false, fading: false }));
}

export function LivingAtmosphereMosaic({
  seedKey,
  density = 48,
  columns = 4,
  swapIntervalMs = DEFAULT_SWAP_INTERVAL_MS,
  className,
  fillContainer = false,
  entityLinks,
}: LivingAtmosphereMosaicProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutState>(() =>
    fillContainer
      ? { columns: 10, rows: 6, density: 60 }
      : {
          columns,
          rows: Math.max(1, Math.ceil(Number(density) / columns)),
          density: Number(density),
        },
  );

  const geometric = selectAtmospherePlane({
    seedKey,
    density: 16,
    preferGeometric: true,
  }).geometric;
  const planeId = selectAtmospherePlane({ seedKey, density: layout.density }).planeId;
  const tiles = selectMosaicTiles(seedKey, layout.density);

  const [mosaicFailed, setMosaicFailed] = useState(false);
  const [preferStatic, setPreferStatic] = useState(false);
  const [cells, setCells] = useState<readonly CellLayers[]>(() => cellsFromTiles(tiles));
  const visibleRef = useRef<readonly AtmosphereTileCredit[]>(tiles);
  const cellsRef = useRef(cells);
  const tickRef = useRef(0);
  const busySlotsRef = useRef<Set<number>>(new Set());
  const layoutKeyRef = useRef(`${layout.columns}x${layout.rows}`);
  const interactive = Boolean(entityLinks && Object.keys(entityLinks).length > 0);

  useLayoutEffect(() => {
    if (!fillContainer) {
      setLayout({
        columns,
        rows: Math.max(1, Math.ceil(Number(density) / columns)),
        density: Number(density),
      });
      return;
    }

    const node = rootRef.current;
    if (!node) return;

    const applySize = (width: number, height: number) => {
      // Ignore collapsed first paint / hidden tabs — keep the last good grid.
      if (width < 120 || height < 120) return;
      const next = computeFillMosaicLayout(width, height, ATMOSPHERE_TILE_CREDITS.length);
      setLayout((prev) =>
        prev.columns === next.columns && prev.rows === next.rows && prev.density === next.density
          ? prev
          : next,
      );
    };

    applySize(node.clientWidth, node.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      applySize(width, height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fillContainer, columns, density]);

  useEffect(() => {
    const key = `${layout.columns}x${layout.rows}:${layout.density}`;
    if (layoutKeyRef.current === key) return;
    layoutKeyRef.current = key;
    const nextTiles = selectMosaicTiles(seedKey, layout.density);
    busySlotsRef.current.clear();
    visibleRef.current = nextTiles;
    setCells(cellsFromTiles(nextTiles));
  }, [layout.columns, layout.rows, layout.density, seedKey]);

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
    if (preferStatic || mosaicFailed || cells.length === 0) {
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
  }, [preferStatic, mosaicFailed, cells.length, seedKey, swapIntervalMs]);

  const showLive = cells.length > 0 && !mosaicFailed && !preferStatic;
  const renderCells: readonly CellLayers[] = showLive ? cells : cellsFromTiles(tiles);

  const showMosaic = renderCells.length > 0 && !mosaicFailed;

  const rootClass = [
    'ds-atmosphere',
    'ds-atmosphere--living',
    fillContainer ? 'ds-atmosphere--fill' : '',
    interactive ? 'ds-atmosphere--interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={rootRef}
      className={rootClass}
      aria-hidden={interactive ? undefined : true}
      data-plane-id={planeId}
      data-columns={layout.columns}
      data-rows={layout.rows}
      style={{
        ['--ds-atmosphere-columns' as string]: String(layout.columns),
        ['--ds-atmosphere-rows' as string]: String(layout.rows),
      }}
    >
      <div
        className="ds-atmosphere__geometric"
        style={{ backgroundImage: `url(${geometric.path})` }}
        aria-hidden="true"
      />
      {showMosaic ? (
        <div
          className={[
            'ds-atmosphere__mosaic',
            'ds-atmosphere__mosaic--living',
            fillContainer ? 'ds-atmosphere__mosaic--fill' : '',
          ]
            .filter(Boolean)
            .join(' ')}
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
                  loading={index < layout.columns ? 'eager' : 'lazy'}
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
