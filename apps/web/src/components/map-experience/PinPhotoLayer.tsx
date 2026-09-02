/**
 * Fetches a surface's pin photo index (lazily, once, on the first hover/focus intent) and mounts
 * one `PinPhotoCard` near whichever pin currently has hover/focus — never more than one. Shared by
 * the Door (`DoorImmersive`, fed by `usePinPhotoHoverAnchor`) and the Atlas (`AtlasExperience`,
 * fed by `MapStage`'s `pinHover` event); both pass a hover target shaped the same way and their
 * own surface's photo endpoint (`/door/photos` or `/atlas/photos`).
 *
 * Portaled to `document.body` and positioned in viewport pixels from the anchor pin's own
 * `getBoundingClientRect()`, so it renders correctly regardless of any transform/zoom context the
 * anchor sits inside (the Door's layout-zoomed board, the Atlas's MapLibre canvas).
 */
'use client';

import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { PinPhotoView } from '../../lib/map-experience/entity-photo-index';
import { PinPhotoCard } from './PinPhotoCard';

void React;

export type PinPhotoHoverTarget = {
  readonly key: string;
  readonly name: string;
  readonly rect: DOMRect;
};

const CARD_WIDTH = 168;
const CARD_ESTIMATED_HEIGHT = 210;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 10;

function anchoredStyle(rect: DOMRect): CSSProperties {
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;

  const centerX = rect.left + rect.width / 2;
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, centerX - CARD_WIDTH / 2),
    Math.max(VIEWPORT_MARGIN, viewportWidth - CARD_WIDTH - VIEWPORT_MARGIN),
  );

  const fitsAbove = rect.top - CARD_ESTIMATED_HEIGHT - ANCHOR_GAP >= VIEWPORT_MARGIN;
  const top = fitsAbove
    ? Math.max(VIEWPORT_MARGIN, rect.top - CARD_ESTIMATED_HEIGHT - ANCHOR_GAP)
    : Math.min(
        rect.bottom + ANCHOR_GAP,
        Math.max(VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN),
      );

  return { top, left };
}

export type PinPhotoLayerProps = {
  readonly target: PinPhotoHoverTarget | null;
  /** `/atlas/photos` or `/door/photos` — fetched once, lazily, on the first non-null target. */
  readonly photosUrl: string;
};

export function PinPhotoLayer({ target, photosUrl }: PinPhotoLayerProps) {
  const [photos, setPhotos] = useState<Readonly<Record<string, PinPhotoView>> | null>(null);
  const [exhaustedKey, setExhaustedKey] = useState<string | null>(null);
  const fetchStartedRef = useRef(false);

  useEffect(() => {
    if (!target || fetchStartedRef.current) return;
    fetchStartedRef.current = true;
    let cancelled = false;
    fetch(photosUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Readonly<Record<string, PinPhotoView>> | null) => {
        if (!cancelled && data) setPhotos(data);
      })
      .catch(() => {
        // Fail closed: no card is exactly as before this feature existed.
      });
    return () => {
      cancelled = true;
    };
  }, [target, photosUrl]);

  if (typeof document === 'undefined') return null;
  if (!target || !photos) return null;
  if (target.key === exhaustedKey) return null;
  const photo = photos[target.key];
  if (!photo) return null;

  return createPortal(
    <PinPhotoCard
      entityId={target.key}
      entityName={target.name.length > 0 ? target.name : 'Documented record'}
      photo={photo}
      style={anchoredStyle(target.rect)}
      onExhausted={() => setExhaustedKey(target.key)}
    />,
    document.body,
  );
}
