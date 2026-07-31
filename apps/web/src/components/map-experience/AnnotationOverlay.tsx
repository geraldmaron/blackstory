/**
 * Migration corridor overlay: an SVG plane over the map plate that reprojects as the camera moves.
 *
 * This renders what it is handed. The corridors come from `migration-corridors.ts` and the curve
 * comes from `arc-geometry.ts`; nothing here knows a fact about the Great Migration except how to
 * draw one and how to caption it honestly.
 *
 * **Why the geometry updates imperatively.** MapLibre fires `move` on every animation frame, and
 * a `trace` camera move flies for 900ms while these arcs are drawing. Routing that through React
 * state would reconcile roughly forty nodes per frame and, worse, would fight the draw-on: the
 * dash animation lives in element style, and a re-render mid-flight is exactly how you get an arc
 * that restarts its own animation forever. So React owns the structure, which is stable, and the
 * move handler writes only `d`, `cx/cy`, `x/y` and the dash length. The dash length is rewritten
 * on every sync deliberately, so an arc that rescales mid-draw stays at the same *fraction* drawn
 * instead of tearing open a gap.
 *
 * **The caption is not decoration.** Seven arcs drawn across the country read as routes people
 * travelled unless something says otherwise. The honesty line from design-direction-v9-atlas.md §6
 * ships with the graphic, in the same component, so the two cannot be separated by a later edit.
 *
 * See docs/ui/patterns-atlas-instrument.md.
 */
'use client';

import React, { useEffect, useRef } from 'react';
import { cx } from '@repo/ui';
import { arcPath } from '../../lib/map-experience/arc-geometry';
import type { MigrationCorridor } from '../../lib/map-experience/migration-corridors';
import './annotation-overlay.css';

void React;

/** Gap between arcs starting to draw. Design law §6, chapter 3. */
export const ARC_STAGGER_MS = 130;
/** How long one arc takes to draw itself. */
export const ARC_DRAW_MS = 1100;
/** Destination dot and label land as the arc arrives, not when it leaves. */
const DESTINATION_REVEAL_MS = 780;
const REVEAL_MS = 500;

/** Vertical nudge so a label sits on the dot's optical centre rather than its baseline. */
const LABEL_BASELINE_OFFSET = 3.5;
/** Horizontal gap between a dot and its label. */
const LABEL_GAP = 8;

const ORIGIN_DOT_RADIUS = 2.6;
const DESTINATION_DOT_RADIUS = 3.4;

/** Minimal structural view of the map. Keeps `maplibre-gl` out of this module's imports. */
export type ProjectingMap = {
  project(lngLat: readonly [number, number]): { x: number; y: number };
  on(type: 'move', listener: () => void): unknown;
  off(type: 'move', listener: () => void): unknown;
};

export type AnnotationOverlayProps = {
  readonly map: ProjectingMap | null;
  readonly corridors: readonly MigrationCorridor[];
  /** Corridors are a layer the reader turns on, and the `trace` camera move turns on for them. */
  readonly visible: boolean;
  readonly className?: string;
};

/**
 * "New Orleans, Louisiana" is the record's name for the place. At map scale, next to a 3px dot,
 * the state is noise: the map is already showing you which state it is.
 */
function shortPlaceLabel(label: string): string {
  const [head] = label.split(',');
  return (head ?? label).trim();
}

function encode(coordinates: readonly [number, number]): string {
  return `${coordinates[0]},${coordinates[1]}`;
}

function readPoint(
  map: ProjectingMap,
  encoded: string | undefined,
): { x: number; y: number } | null {
  if (!encoded) return null;
  const [longitude, latitude] = encoded.split(',').map(Number);
  if (longitude === undefined || latitude === undefined) return null;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  return map.project([longitude, latitude]);
}

/**
 * Reprojects every anchored node. Called on mount and on every `move`; touches geometry only, so
 * it is safe to run mid-animation.
 */
function syncGeometry(root: SVGSVGElement, map: ProjectingMap): void {
  for (const path of root.querySelectorAll<SVGPathElement>('path[data-from]')) {
    const from = readPoint(map, path.dataset['from']);
    const to = readPoint(map, path.dataset['to']);
    if (!from || !to) continue;

    const { d, length } = arcPath(from, to);
    path.setAttribute('d', d);
    // Drives both `stroke-dasharray` and the resting `stroke-dashoffset`, so the dash always
    // matches the path it covers. Rounded up: a dash shorter than its path shows a gap.
    path.style.setProperty('--ds-arc-length', String(Math.ceil(length)));
  }

  for (const dot of root.querySelectorAll<SVGCircleElement>('circle[data-ll]')) {
    const point = readPoint(map, dot.dataset['ll']);
    if (!point) continue;
    dot.setAttribute('cx', point.x.toFixed(1));
    dot.setAttribute('cy', point.y.toFixed(1));
  }

  for (const label of root.querySelectorAll<SVGTextElement>('text[data-ll]')) {
    const point = readPoint(map, label.dataset['ll']);
    if (!point) continue;
    const gap = label.getAttribute('text-anchor') === 'end' ? -LABEL_GAP : LABEL_GAP;
    label.setAttribute('x', (point.x + gap).toFixed(1));
    label.setAttribute('y', (point.y + LABEL_BASELINE_OFFSET).toFixed(1));
  }
}

/** Applies the cascade. One shot: stagger is a property of the reveal, not of every frame. */
function startDrawOn(root: SVGSVGElement): void {
  root.querySelectorAll<SVGGElement>('g[data-corridor]').forEach((group, index) => {
    const base = index * ARC_STAGGER_MS;

    const path = group.querySelector<SVGPathElement>('path[data-from]');
    if (path) path.style.animationDelay = `${base}ms`;

    for (const node of group.querySelectorAll<SVGElement>('[data-reveal]')) {
      const arrival = node.dataset['reveal'] === 'destination' ? DESTINATION_REVEAL_MS : 0;
      node.style.animationDelay = `${base + arrival}ms`;
    }
  });

  root.dataset['draw'] = 'on';
}

export function AnnotationOverlay({ map, corridors, visible, className }: AnnotationOverlayProps) {
  const rootRef = useRef<SVGSVGElement | null>(null);
  // Keyed on the corridor set rather than the array identity. A parent that rebuilds its
  // corridors array each render would otherwise replay the whole cascade on every render.
  const corridorKey = corridors.map((corridor) => corridor.id).join('|');

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !map || !visible) return;

    let drawn = false;
    const sync = () => {
      syncGeometry(root, map);
      // The cascade needs measured lengths, so it can only start after the first projection.
      if (!drawn) {
        drawn = true;
        startDrawOn(root);
      }
    };

    sync();
    map.on('move', sync);

    return () => {
      map.off('move', sync);
      // Reset, so re-showing the layer replays the cascade rather than popping it in complete.
      root.dataset['draw'] = 'pending';
    };
    // `corridorKey` deliberately stands in for `corridors` here. See its definition above.
  }, [map, corridorKey, visible]);

  if (!visible || corridors.length === 0) return null;

  // One note for the whole graphic. Every corridor carries the same line by construction, and
  // repeating it seven times would read as noise rather than as a caveat.
  const note = corridors[0]?.note;

  return (
    <div className={cx('ds-annotation', className)}>
      <svg
        ref={rootRef}
        className="ds-annotation__plane"
        data-draw="pending"
        aria-hidden="true"
        style={
          {
            '--ds-arc-duration': `${ARC_DRAW_MS}ms`,
            '--ds-reveal-duration': `${REVEAL_MS}ms`,
          } as React.CSSProperties
        }
      >
        {corridors.map((corridor, index) => (
          <g key={corridor.id} data-corridor={corridor.id}>
            <path
              className={cx('ds-annotation__arc', index % 2 === 1 && 'ds-annotation__arc--soft')}
              data-from={encode(corridor.from.coordinates)}
              data-to={encode(corridor.to.coordinates)}
            />

            <circle
              className="ds-annotation__dot"
              data-ll={encode(corridor.from.coordinates)}
              data-reveal="origin"
              r={ORIGIN_DOT_RADIUS}
            />
            <text
              className="ds-annotation__label ds-annotation__label--origin"
              data-ll={encode(corridor.from.coordinates)}
              data-reveal="origin"
              textAnchor="end"
            >
              {shortPlaceLabel(corridor.from.label)}
            </text>

            <circle
              className="ds-annotation__dot ds-annotation__dot--destination"
              data-ll={encode(corridor.to.coordinates)}
              data-reveal="destination"
              r={DESTINATION_DOT_RADIUS}
            />
            <text
              className="ds-annotation__label"
              data-ll={encode(corridor.to.coordinates)}
              data-reveal="destination"
              textAnchor="start"
            >
              {shortPlaceLabel(corridor.to.label)}
            </text>
          </g>
        ))}
      </svg>

      {note ? <p className="ds-annotation__note">{note}</p> : null}
    </div>
  );
}
