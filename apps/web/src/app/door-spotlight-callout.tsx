/**
 * The record the column shows, shown where it is: a mark on its coordinate, a 1px leader and a
 * small card beside it. It follows the pin on every camera frame and only ever sits inside the
 * Door's map window (`.ds-door__window`), which on every layout excludes the headline column, so
 * the callout can never cover the headline. When no side of the pin has room inside the window,
 * or the pin is outside it, the callout hides rather than overlapping anything.
 *
 * The card is a label, the name and the locality; the column beside the map carries the record. On
 * a phone (the stacked layout) the card is one line, stacked
 * above or below the pin so it never spreads across the country.
 *
 * The mark is drawn here, not by the plate, because at national zoom the record usually sits
 * inside a group circle. It follows the record's stored precision (P-03): a solid dot for a site,
 * a hollow ring for a city or neighborhood. County and state records are never picked
 * (`eligibleStoryRecords`), since the map draws no point for them.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { AtlasCameraTarget } from '../components/map-stage/MapStage';
import { useMapStage } from '../components/map-stage/MapStage';
import type { RecordMark } from '../lib/map-experience/geo-precision';
import { CLUSTER_RADIUS_BY_COUNT } from '../lib/map-experience/dignity-style';
import {
  EXPLORE_CLUSTER_LAYER_ID,
  EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
} from './map/explore-layer-ids';
import { DoorRecordLink } from './door-record-link';
import { queryRenderedLayers } from '../components/map-stage/query-rendered';

void React;

type Box = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type CalloutSide = 'right' | 'left' | 'above' | 'below';

export type CalloutPlacement = {
  readonly side: CalloutSide;
  readonly left: number;
  readonly top: number;
  /** The leader as a box: a horizontal or vertical 1px run from the pin to the card edge. */
  readonly leader: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
};

const INSET = 16;
/** A single record's mark (a ring, the larger of the two) with its halo. */
const SINGLE_MARK_RADIUS_PX = 10;
const GAP = 24;
/** The attribution's 44px "i" plus a gap, in the window's bottom-right corner. */
const ATTRIBUTION_CLEARANCE = 44 + 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** The Door's stacked layout (door-home.css): a phone, or any portrait screen. */
const STACKED_QUERY = '(max-width: 47.9375rem), (max-aspect-ratio: 1/1)';

/** Area two boxes share. */
function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Where the card goes for a pin at (x, y) inside `frame`, or null when it cannot be shown without
 * leaving the frame. Of the sides that fit, the one covering the least of `obstacles` (the group
 * circles and record marks on screen) wins: the side of the pin with the most free map. Ties keep
 * reading order: right of the pin first, then left, above, below.
 *
 * `stacked` (a phone's short, wide window, where a card beside the pin spans the country): the
 * card docks along the window's bottom edge, under the country and above the headline, with a
 * vertical leader up to the pin; above the pin when the pin itself sits that low.
 */
export function placeCallout(
  pin: { readonly x: number; readonly y: number },
  card: { readonly width: number; readonly height: number },
  frame: Box,
  stacked = false,
  obstacles: readonly Box[] = [],
): CalloutPlacement | null {
  const { x, y } = pin;
  const { width: w, height: h } = card;
  if (x < frame.left || x > frame.right || y < frame.top || y > frame.bottom) return null;
  const fits = (left: number, top: number) =>
    left >= frame.left + INSET &&
    left + w <= frame.right - INSET &&
    top >= frame.top + INSET &&
    top + h <= frame.bottom - INSET;
  const clampTop = (top: number) => clamp(top, frame.top + INSET, frame.bottom - INSET - h);
  const clampLeft = (left: number) => clamp(left, frame.left + INSET, frame.right - INSET - w);
  // Beside the pin the card may sit centered on it, mostly above it or mostly below it; above or
  // below it, centered, toward the left or toward the right. More room to find open map.
  const sideTops = [y - h / 2, y - h + 16, y - 16].map(clampTop);
  const stackLefts = [x - w / 2, x - w + 16, x - 16].map(clampLeft);
  const sides: CalloutPlacement[] = sideTops.flatMap((top) => [
    {
      side: 'right' as const,
      left: x + GAP,
      top,
      leader: { left: x, top: y, width: GAP, height: 1 },
    },
    {
      side: 'left' as const,
      left: x - GAP - w,
      top,
      leader: { left: x - GAP, top: y, width: GAP, height: 1 },
    },
  ]);
  const stacks: CalloutPlacement[] = stackLefts.flatMap((left) => [
    {
      side: 'above' as const,
      left,
      top: y - GAP - h,
      leader: { left: x, top: y - GAP, width: 1, height: GAP },
    },
    {
      side: 'below' as const,
      left,
      top: y + GAP,
      leader: { left: x, top: y, width: 1, height: GAP },
    },
  ]);
  const stackLeft = stackLefts[0]!;
  const docked: CalloutPlacement = {
    side: 'below',
    left: stackLeft,
    top: frame.bottom - INSET - h,
    leader: { left: x, top: y, width: 1, height: frame.bottom - INSET - h - y },
  };
  const candidates = stacked
    ? [...(docked.top >= y + GAP ? [docked] : []), ...stacks, ...sides]
    : [...sides, ...stacks];
  let best: CalloutPlacement | null = null;
  let bestCover = Infinity;
  for (const candidate of candidates) {
    if (!fits(candidate.left, candidate.top)) continue;
    // A side leader has to land on the card's edge, not past a corner of it.
    const onEdge =
      candidate.side === 'right' || candidate.side === 'left'
        ? y >= candidate.top + 8 && y <= candidate.top + h - 8
        : x >= candidate.left + 8 && x <= candidate.left + w - 8;
    if (!onEdge) continue;
    const box = {
      left: candidate.left,
      top: candidate.top,
      right: candidate.left + w,
      bottom: candidate.top + h,
    };
    const cover = obstacles.reduce((sum, obstacle) => sum + overlapArea(box, obstacle), 0);
    if (cover < bestCover) {
      best = candidate;
      bestCover = cover;
    }
  }
  return best;
}

/** The plate's group circles and record marks on screen, as boxes the card should not cover. */
function markObstacles(map: EventedMap, plate: DOMRect): Box[] {
  // Before the entity layers mount (a cold load, a style rebuild) there is nothing to avoid.
  const features = queryRenderedLayers<{ geometry: unknown; properties: unknown }>(map, undefined, [
    EXPLORE_CLUSTER_LAYER_ID,
    EXPLORE_UNCLUSTERED_POINT_LAYER_ID,
  ]);
  return features.map((feature) => {
    const count = Number((feature.properties as { point_count?: number }).point_count ?? 0);
    const radius =
      count > 0
        ? ([...CLUSTER_RADIUS_BY_COUNT].reverse().find(([min]) => count >= min)?.[1] ?? 12)
        : SINGLE_MARK_RADIUS_PX;
    const point = map.project(
      (feature.geometry as { coordinates: [number, number] }).coordinates as never,
    );
    const x = plate.left + point.x;
    const y = plate.top + point.y;
    return { left: x - radius, top: y - radius, right: x + radius, bottom: y + radius };
  });
}

function rectBox(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

/** MapLibre's own event and query API, which the stage's camera handle does not name. */
type EventedMap = AtlasCameraTarget & {
  on(type: 'move' | 'resize' | 'idle', listener: () => void): unknown;
  off(type: 'move' | 'resize' | 'idle', listener: () => void): unknown;
  queryRenderedFeatures(
    geometry: undefined,
    options: { layers: string[] },
  ): { geometry: unknown; properties: unknown }[];
  getLayer(id: string): unknown;
};

export type DoorSpotlightCalloutProps = {
  /** Shown once this mount has framed the plate, on the opening and every decade of the walk. */
  readonly active: boolean;
  readonly lngLat: readonly [number, number];
  readonly mark: RecordMark;
  readonly name: string;
  readonly locality: string | null;
  readonly href: string;
  /** The uncovered map window the callout must stay inside. */
  readonly frameRef: React.RefObject<HTMLElement | null>;
};

export function DoorSpotlightCallout({
  active,
  lngLat,
  mark,
  name,
  locality,
  href,
  frameRef,
}: DoorSpotlightCalloutProps) {
  const stage = useMapStage();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const markRef = useRef<HTMLSpanElement | null>(null);
  const leaderRef = useRef<HTMLSpanElement | null>(null);
  const [side, setSide] = useState<CalloutSide | null>(null);
  const sideRef = useRef<CalloutSide | null>(null);
  const [lng, lat] = lngLat;

  useEffect(() => {
    const show = (next: CalloutSide | null) => {
      if (sideRef.current === next) return;
      sideRef.current = next;
      setSide(next);
    };
    if (!active) {
      show(null);
      return;
    }
    const map = stage.getMap() as EventedMap | null;
    if (!map) return;
    let frame: number | null = null;
    // Querying every rendered mark costs a frame, so the marks are read at rest and the last
    // answer, carried along with the pin, stands in while the camera moves.
    let marks: { readonly boxes: Box[]; readonly pin: { x: number; y: number } } | null = null;
    let atRest = true;
    const place = () => {
      frame = null;
      const layer = layerRef.current;
      const card = cardRef.current;
      const windowEl = frameRef.current;
      if (!layer || !card || !windowEl) return;
      // Fixed layers resolve against the nearest transformed ancestor, so measure the layer's
      // own origin rather than assuming the viewport's.
      const origin = layer.getBoundingClientRect();
      const plate = map.getContainer().getBoundingClientRect();
      const projected = map.project([lng, lat] as never);
      const pin = { x: plate.left + projected.x, y: plate.top + projected.y };
      const win = windowEl.getBoundingClientRect();
      const stacked = window.matchMedia(STACKED_QUERY).matches;
      if (atRest || !marks) marks = { boxes: markObstacles(map, plate), pin };
      const shiftX = pin.x - marks.pin.x;
      const shiftY = pin.y - marks.pin.y;
      const obstacles = marks.boxes.map((box) => ({
        left: box.left + shiftX,
        top: box.top + shiftY,
        right: box.right + shiftX,
        bottom: box.bottom + shiftY,
      }));
      const placement = placeCallout(
        pin,
        { width: card.offsetWidth, height: card.offsetHeight },
        // Stacked, the card docks along the window's foot, where the attribution's "i" sits in
        // the right corner (door-home.css); the card docks one row above it.
        stacked ? { ...rectBox(win), bottom: win.bottom - ATTRIBUTION_CLEARANCE } : win,
        stacked,
        obstacles,
      );
      if (!placement) {
        show(null);
        return;
      }
      const dx = -origin.left;
      const dy = -origin.top;
      card.style.transform = `translate(${placement.left + dx}px, ${placement.top + dy}px)`;
      const leader = leaderRef.current;
      if (leader) {
        leader.style.transform = `translate(${placement.leader.left + dx}px, ${placement.leader.top + dy}px)`;
        leader.style.width = `${placement.leader.width}px`;
        leader.style.height = `${placement.leader.height}px`;
      }
      if (markRef.current) {
        markRef.current.style.transform = `translate(${pin.x + dx}px, ${pin.y + dy}px)`;
      }
      show(placement.side);
    };
    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(place);
    };
    const moving = () => {
      atRest = false;
      schedule();
    };
    const resting = () => {
      atRest = true;
      schedule();
    };
    map.on('move', moving);
    map.on('resize', resting);
    // The groups the card avoids may still be loading when the camera stops: place it again once
    // the plate has drawn them.
    map.on('idle', resting);
    window.addEventListener('resize', resting);
    schedule();
    return () => {
      map.off('move', moving);
      map.off('resize', resting);
      map.off('idle', resting);
      window.removeEventListener('resize', resting);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [active, frameRef, lat, lng, stage]);

  return (
    <div
      className="ds-map-callout ds-map-callout--layer"
      ref={layerRef}
      data-side={side ?? undefined}
      data-shown={active && side !== null ? 'true' : 'false'}
      aria-hidden={active && side !== null ? undefined : true}
    >
      <span className={`ds-map-callout__mark ds-map-callout__mark--${mark}`} ref={markRef} />
      <span className="ds-map-callout__leader" ref={leaderRef} />
      <div className="ds-map-callout__card" ref={cardRef} data-ground="paper">
        <DoorRecordLink className="ds-map-callout__link" href={href}>
          <span className="ds-map-callout__name">{name}</span>
          {locality ? <span className="ds-map-callout__meta">{locality}</span> : null}
        </DoorRecordLink>
      </div>
    </div>
  );
}
