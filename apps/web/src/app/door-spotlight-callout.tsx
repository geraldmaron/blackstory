/**
 * The visit's spotlight record, shown where it is: a mark on its coordinate, a 1px leader and a
 * small card beside it. It follows the pin on every camera frame and only ever sits inside the
 * Door's map window (`.ds-door__window`), which on every layout excludes the headline column, so
 * the callout can never cover the headline. When no side of the pin has room inside the window,
 * or the pin is outside it, the callout hides rather than overlapping anything.
 *
 * On a phone (the stacked layout) the card is one line, the name and "Open the record", stacked
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
import { DoorRecordLink } from './door-record-link';

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
const GAP = 24;
/** The attribution's 44px "i" plus a gap, in the window's bottom-right corner. */
const ATTRIBUTION_CLEARANCE = 44 + 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** The Door's stacked layout (door-home.css): a phone, or any portrait screen. */
const STACKED_QUERY = '(max-width: 47.9375rem), (max-aspect-ratio: 1/1)';

/**
 * Where the card goes for a pin at (x, y) inside `frame`, or null when it cannot be shown without
 * leaving the frame. Right of the pin first (reading order), then left, above, below.
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
): CalloutPlacement | null {
  const { x, y } = pin;
  const { width: w, height: h } = card;
  if (x < frame.left || x > frame.right || y < frame.top || y > frame.bottom) return null;
  const fits = (left: number, top: number) =>
    left >= frame.left + INSET &&
    left + w <= frame.right - INSET &&
    top >= frame.top + INSET &&
    top + h <= frame.bottom - INSET;
  const sideTop = clamp(y - h / 2, frame.top + INSET, frame.bottom - INSET - h);
  const stackLeft = clamp(x - w / 2, frame.left + INSET, frame.right - INSET - w);
  const sides: CalloutPlacement[] = [
    {
      side: 'right',
      left: x + GAP,
      top: sideTop,
      leader: { left: x, top: y, width: GAP, height: 1 },
    },
    {
      side: 'left',
      left: x - GAP - w,
      top: sideTop,
      leader: { left: x - GAP, top: y, width: GAP, height: 1 },
    },
  ];
  const stacks: CalloutPlacement[] = [
    {
      side: 'above',
      left: stackLeft,
      top: y - GAP - h,
      leader: { left: x, top: y - GAP, width: 1, height: GAP },
    },
    {
      side: 'below',
      left: stackLeft,
      top: y + GAP,
      leader: { left: x, top: y, width: 1, height: GAP },
    },
  ];
  const docked: CalloutPlacement = {
    side: 'below',
    left: stackLeft,
    top: frame.bottom - INSET - h,
    leader: { left: x, top: y, width: 1, height: frame.bottom - INSET - h - y },
  };
  const candidates = stacked
    ? [...(docked.top >= y + GAP ? [docked] : []), ...stacks, ...sides]
    : [...sides, ...stacks];
  return (
    candidates.find((candidate) => {
      if (!fits(candidate.left, candidate.top)) return false;
      // A side leader has to land on the card's edge, not past a corner of it.
      if (candidate.side === 'right' || candidate.side === 'left') {
        return y >= candidate.top + 8 && y <= candidate.top + h - 8;
      }
      return x >= candidate.left + 8 && x <= candidate.left + w - 8;
    }) ?? null
  );
}

function rectBox(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

/** MapLibre's own event API, which the stage's camera handle does not name. */
type EventedMap = AtlasCameraTarget & {
  on(type: 'move' | 'resize', listener: () => void): unknown;
  off(type: 'move' | 'resize', listener: () => void): unknown;
};

export type DoorSpotlightCalloutProps = {
  /** Shown only on the opening, once this mount has framed the plate. */
  readonly active: boolean;
  readonly lngLat: readonly [number, number];
  readonly mark: RecordMark;
  readonly name: string;
  readonly locality: string | null;
  readonly line: string;
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
  line,
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
      const placement = placeCallout(
        pin,
        { width: card.offsetWidth, height: card.offsetHeight },
        // Stacked, the card docks along the window's foot, where the attribution's "i" sits in
        // the right corner (door-home.css); the card docks one row above it.
        stacked ? { ...rectBox(win), bottom: win.bottom - ATTRIBUTION_CLEARANCE } : win,
        stacked,
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
    map.on('move', schedule);
    map.on('resize', schedule);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      map.off('move', schedule);
      map.off('resize', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [active, frameRef, lat, lng, stage]);

  return (
    <div
      className="ds-door-callout"
      ref={layerRef}
      data-side={side ?? undefined}
      data-shown={active && side !== null ? 'true' : 'false'}
      aria-hidden={active && side !== null ? undefined : true}
    >
      <span className={`ds-door-callout__mark ds-door-callout__mark--${mark}`} ref={markRef} />
      <span className="ds-door-callout__leader" ref={leaderRef} />
      <div className="ds-door-callout__card" ref={cardRef}>
        <DoorRecordLink className="ds-door-callout__link" href={href}>
          <span className="ds-door-callout__name">{name}</span>
          {locality ? <span className="ds-door-callout__place">{locality}</span> : null}
          <span className="ds-door-callout__line">{line}</span>
          <span className="ds-door-callout__open">Open the record</span>
        </DoorRecordLink>
      </div>
    </div>
  );
}
