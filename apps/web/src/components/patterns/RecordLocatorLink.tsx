'use client';

/**
 * A place's locator as a way into the real map: a still preview, and a tap anywhere on it opens
 * the full-screen map on that place.
 *
 * This replaces a hand-built pan/zoom SVG "map" (wheel, drag, two-finger pinch, its own hints and
 * zoom buttons) that lived inside a scrolling page. On a phone that is the pattern the platform
 * conventions steer away from: a map embedded in a page is a preview, and the map itself is one
 * tap away, full-screen, with real gestures (Apple Maps / Airbnb / Zillow; Google's `cooperative`
 * mode exists only as a fallback). It also could never zoom past a national SVG, so the gestures
 * promised a map they could not deliver.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { locatorPinPercent } from '../../lib/map-experience/albers-usa';
import { savePinContinuity } from '../../lib/discovery/pin-continuity';
import {
  defaultLocatorView,
  locatorCanvasTransform,
  neighborhoodLocatorView,
} from './record-locator-view';

void React;

const DEFAULT_LOCATOR_SIZE = { width: 720, height: 420 };

export type RecordLocatorLinkProps = {
  readonly lat: number;
  readonly lng: number;
  readonly label: string;
  readonly accessibleName?: string;
  /** Catalog entity id for pin continuity across the handoff to the live map. */
  readonly entityId?: string;
  /** The live map, opened on this place. Without it the locator is a plain picture. */
  readonly atlasHref?: string;
  /** Open framed on the pin's region (place hero) rather than the national inset. */
  readonly neighborhood?: boolean;
  readonly className?: string;
};

export function RecordLocatorLink({
  lat,
  lng,
  label,
  accessibleName,
  entityId,
  atlasHref,
  neighborhood = false,
  className,
}: RecordLocatorLinkProps) {
  const pin = useMemo(() => locatorPinPercent(lng, lat), [lng, lat]);
  const rootRef = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState(DEFAULT_LOCATOR_SIZE);

  // The neighbourhood frame depends on the box it is drawn in; measuring is layout, not gesture.
  useEffect(() => {
    const root = rootRef.current;
    if (!neighborhood || !root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width < 1 || box.height < 1) return;
      setSize((current) =>
        Math.abs(current.width - box.width) < 1 && Math.abs(current.height - box.height) < 1
          ? current
          : { width: box.width, height: box.height },
      );
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [neighborhood]);

  if (!pin) return null;

  const view = neighborhood
    ? neighborhoodLocatorView(pin.x, pin.y, size.width, size.height)
    : defaultLocatorView();
  const place = accessibleName?.trim() || label.trim();
  const rootClass = ['ds-locator', atlasHref ? 'ds-locator--link' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  const picture = (
    <>
      <span
        className="ds-locator__canvas"
        style={{
          transform: locatorCanvasTransform(view),
          ['--locator-scale' as string]: String(view.scale),
        }}
        aria-hidden="true"
      >
        <span className="ds-locator__ground" />
        <span
          className="ds-locator__pin"
          style={{ left: `${pin.x.toFixed(4)}%`, top: `${pin.y.toFixed(4)}%` }}
        />
      </span>
      {atlasHref ? (
        <span className="ds-locator__open" aria-hidden="true">
          Open map
        </span>
      ) : null}
    </>
  );

  if (!atlasHref) {
    return (
      <div
        ref={(node) => {
          rootRef.current = node;
        }}
        className={rootClass}
        role="img"
        aria-label={place ? `Locator map with ${place} marked.` : 'Locator map.'}
      >
        {picture}
      </div>
    );
  }

  return (
    <a
      ref={(node) => {
        rootRef.current = node;
      }}
      className={rootClass}
      href={atlasHref}
      aria-label={place ? `Open ${place} on the map` : 'Open the map'}
      onClick={() => {
        savePinContinuity({
          entityId: entityId ?? label,
          lng,
          lat,
          zoom: 11,
          label: accessibleName ?? label,
        });
      }}
    >
      {picture}
    </a>
  );
}
