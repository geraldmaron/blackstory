/**
 * Fetches a surface's pin photo index (lazily, once, on the first hover/focus intent) and mounts
 * one `PinPhotoCard` near whichever pin currently has hover/focus — never more than one. Shared by
 * the Door (`DoorImmersive`) and Explore (`AtlasExperience`), both fed by `MapStage`'s `pinHover`
 * event; each passes a hover target shaped the same way and its own surface's photo endpoint
 * (`/door/photos` or `/atlas/photos`).
 *
 * Portaled to `document.body` and positioned in viewport pixels from the anchor pin's own
 * `getBoundingClientRect()`, so it renders correctly regardless of any transform context the
 * anchor sits inside (MapLibre's marker layer on either surface).
 */
'use client';

import React, { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { usePhotoIndex } from '../../lib/map-experience/use-photo-index';
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
  // One shared, lazy fetch per surface (`use-photo-index.ts`): the record sheet's mast reads the
  // same index, so the hover card and the sheet never request it twice. Fails closed to no card.
  const photos = usePhotoIndex(photosUrl, target !== null);
  const [exhaustedKey, setExhaustedKey] = useState<string | null>(null);

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
