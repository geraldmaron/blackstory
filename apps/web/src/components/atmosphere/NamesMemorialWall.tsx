/**
 * Typographic memorial field for the map stage underlay — scattered names
 * (police/state violence and racial terror) that breathe in and out unevenly.
 * Mounted strictly under the MapLibre canvas (`aria-hidden`); never an overlay.
 * Soft opacity fades pause under reduced-motion, Save-Data, or a hidden document.
 */
'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  computeNamesWallLayout,
  type NamesWallLayout,
  type NamesWallSlot,
} from './compute-names-wall-layout';
import {
  MEMORIAL_NAMES,
  memorialNameLabel,
  selectMemorialNames,
  type MemorialNameEntry,
} from './memorial-names';
import {
  applyMemorialNameSwap,
  memorialBreathBatchSize,
  pickMemorialNameSwap,
  type MemorialNameLayers,
} from './select-memorial-swap';
import './atmosphere.css';

void React;

const DEFAULT_SWAP_INTERVAL_MS = 2800;
const CROSSFADE_MS = 2400;
const STAGGER_MS = 420;

export type NamesMemorialWallProps = {
  readonly seedKey?: string;
  readonly className?: string;
  readonly swapIntervalMs?: number;
  readonly pool?: readonly MemorialNameEntry[];
};

function glyphFromEntry(entry: MemorialNameEntry | null, present: boolean): MemorialNameLayers {
  return {
    a: entry,
    b: entry,
    showB: false,
    fading: false,
    present,
  };
}

function glyphsFromLayout(
  layout: NamesWallLayout,
  seedKey: string,
  pool: readonly MemorialNameEntry[],
): MemorialNameLayers[] {
  const names = selectMemorialNames(`${seedKey}:${layout.density}`, layout.density, pool);
  let nameIndex = 0;
  return layout.slots.map((slot) => {
    if (!slot.initiallyOccupied) return glyphFromEntry(null, false);
    const entry = names[nameIndex] ?? null;
    nameIndex += 1;
    return glyphFromEntry(entry, entry !== null);
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function saveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

function slotStyle(slot: NamesWallSlot): React.CSSProperties {
  return {
    left: `${slot.xPct}%`,
    top: `${slot.yPct}%`,
    '--ds-names-wall-scale': String(slot.scale),
    '--ds-names-wall-ink': String(slot.ink),
    '--ds-names-wall-rotate': `${slot.rotateDeg}deg`,
  } as React.CSSProperties;
}

export function NamesMemorialWall({
  seedKey = 'map',
  className,
  swapIntervalMs = DEFAULT_SWAP_INTERVAL_MS,
  pool = MEMORIAL_NAMES,
}: NamesMemorialWallProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<NamesWallLayout>(() =>
    computeNamesWallLayout(1280, 800, pool.length, seedKey),
  );
  const [glyphs, setGlyphs] = useState<MemorialNameLayers[]>(() =>
    glyphsFromLayout(computeNamesWallLayout(1280, 800, pool.length, seedKey), seedKey, pool),
  );
  const tickRef = useRef(0);
  const glyphsRef = useRef(glyphs);
  glyphsRef.current = glyphs;
  const layoutKeyRef = useRef(`${layout.density}:${layout.slots.length}`);

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const apply = (width: number, height: number) => {
      const next = computeNamesWallLayout(width, height, pool.length, seedKey);
      const key = `${next.density}:${next.slots.length}`;
      if (key === layoutKeyRef.current) return;
      layoutKeyRef.current = key;
      setLayout(next);
      setGlyphs(glyphsFromLayout(next, seedKey, pool));
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      apply(width, height);
    });
    observer.observe(node);
    apply(node.clientWidth, node.clientHeight);
    return () => observer.disconnect();
  }, [pool, seedKey]);

  useEffect(() => {
    if (prefersReducedMotion() || saveDataEnabled()) return;

    let cancelled = false;
    const busy = new Set<number>();
    const timeoutIds: number[] = [];

    const runBreath = (staggerIndex: number) => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (prefersReducedMotion() || saveDataEnabled()) return;

      tickRef.current += 1;
      const swap = pickMemorialNameSwap(glyphsRef.current, pool, seedKey, tickRef.current);
      if (!swap || busy.has(swap.cellIndex)) return;

      busy.add(swap.cellIndex);
      setGlyphs((prev) => applyMemorialNameSwap(prev, swap));
      const clearId = window.setTimeout(() => {
        busy.delete(swap.cellIndex);
        if (cancelled) return;
        setGlyphs((prev) =>
          prev.map((glyph, index) =>
            index === swap.cellIndex ? { ...glyph, fading: false } : glyph,
          ),
        );
      }, CROSSFADE_MS + 80 + staggerIndex * 30);
      timeoutIds.push(clearId);
    };

    const runBatch = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const batch = memorialBreathBatchSize(seedKey, tickRef.current + 1);
      for (let i = 0; i < batch; i += 1) {
        const id = window.setTimeout(() => runBreath(i), i * STAGGER_MS);
        timeoutIds.push(id);
      }
    };

    const intervalId = setInterval(runBatch, swapIntervalMs);
    const kickId = window.setTimeout(runBatch, 1400);
    timeoutIds.push(kickId);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      for (const id of timeoutIds) window.clearTimeout(id);
    };
  }, [pool, seedKey, swapIntervalMs, layout.density, layout.slots.length]);

  const classNames = ['ds-map-names-wall', className].filter(Boolean).join(' ');

  return (
    <div ref={rootRef} className={classNames} aria-hidden="true">
      {layout.slots.map((slot, index) => {
        const glyph = glyphs[index];
        if (!glyph) return null;
        const active = glyph.showB ? glyph.b : glyph.a;
        const title = active && glyph.present ? memorialNameLabel(active) : undefined;
        return (
          <div
            key={`memorial-glyph-${index}`}
            className={[
              'ds-map-names-wall__glyph',
              `ds-map-names-wall__glyph--${slot.weight}`,
              glyph.present ? 'ds-map-names-wall__glyph--present' : 'ds-map-names-wall__glyph--empty',
              glyph.fading ? 'ds-map-names-wall__glyph--fading' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={slotStyle(slot)}
            title={title}
          >
            <span
              className={[
                'ds-map-names-wall__layer',
                glyph.showB ? 'ds-map-names-wall__layer--under' : 'ds-map-names-wall__layer--over',
              ].join(' ')}
            >
              {glyph.a ? (
                <>
                  <span className="ds-map-names-wall__name">{glyph.a.name}</span>
                  <span className="ds-map-names-wall__meta">
                    {glyph.a.year}
                    {glyph.a.place ? ` · ${glyph.a.place}` : ''}
                  </span>
                </>
              ) : null}
            </span>
            <span
              className={[
                'ds-map-names-wall__layer',
                glyph.showB ? 'ds-map-names-wall__layer--over' : 'ds-map-names-wall__layer--under',
              ].join(' ')}
            >
              {glyph.b ? (
                <>
                  <span className="ds-map-names-wall__name">{glyph.b.name}</span>
                  <span className="ds-map-names-wall__meta">
                    {glyph.b.year}
                    {glyph.b.place ? ` · ${glyph.b.place}` : ''}
                  </span>
                </>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
