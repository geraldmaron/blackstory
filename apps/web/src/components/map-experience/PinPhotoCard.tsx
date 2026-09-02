/**
 * A small photo card anchored to one map pin — the Door, the Atlas, and (once `RecordSheet`
 * grows one) the record sheet's own mast all render this same component, so the photo reads the
 * same wherever a pin can offer one. "The photo belongs to the pin": this is never a tile band, a
 * grid, or a gallery — one card, for one pin, at a time.
 *
 * Reuses the entity mast's own photo pieces rather than duplicating them: `ds-entity-photo` /
 * `ds-entity-photo__img` (the shared img treatment) and `primaryImageCreditCaption` /
 * `entityPrimaryImageAlt` (the shared credit-line and alt-text logic) from `record-mark.ts`, and
 * the same extension-swap fallback chain `EntityMastMedia` tries
 * (`buildEntityMastImageCandidates`). A pin card fails closed by disappearing, not by falling
 * back to a symbolic record mark — a mark on a hovered pin would read as a second, contradictory
 * claim ("here's a photo" / "here's a symbol because there isn't one") for a card that only ever
 * mounts because the index already says this entity has a photo.
 */
'use client';

import React, { useEffect, useState, type CSSProperties } from 'react';
import type { PinPhotoView } from '../../lib/map-experience/entity-photo-index';
import { buildEntityMastImageCandidates } from '../entity/entity-mast-image-candidates';
import { entityPrimaryImageAlt, primaryImageCreditCaption } from '../entity/record-mark';
import './pin-photo-card.css';

void React;

export type PinPhotoCardProps = {
  readonly entityId: string;
  readonly entityName: string;
  readonly photo: PinPhotoView;
  /** Fixed-position anchor, computed by the caller from the hovered/selected pin's own rect. */
  readonly style: CSSProperties;
  /** Every published candidate URL failed — the caller should stop rendering this card. */
  readonly onExhausted: () => void;
};

export function PinPhotoCard({
  entityId,
  entityName,
  photo,
  style,
  onExhausted,
}: PinPhotoCardProps) {
  const candidates = React.useMemo(() => buildEntityMastImageCandidates(photo.url), [photo.url]);
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [photo.url]);

  if (candidates.length === 0) {
    return null;
  }
  if (urlIndex >= candidates.length) {
    return null;
  }

  const src = candidates[urlIndex]!;
  const alt = entityPrimaryImageAlt(photo.alt, entityName);
  const caption = primaryImageCreditCaption({
    credit: photo.credit,
    // Pin cards only ever carry `rightsStatus`-free credit text (`entity-photo-index.ts`); the
    // sanitizer's rights label is cosmetic here, so a neutral status keeps it out of the caption
    // rather than guessing one.
    rightsStatus: 'licensed',
  });
  const creditId = `pin-photo-credit-${entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'x'}`;

  return (
    <div className="ds-pin-photo-card" style={style} role="group" aria-label={entityName}>
      <figure className="ds-entity-photo ds-pin-photo-card__figure" aria-describedby={creditId}>
        {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL, anchored to a map pin */}
        <img
          key={src}
          src={src}
          alt={alt}
          className="ds-entity-photo__img ds-pin-photo-card__img"
          loading="lazy"
          decoding="async"
          onError={() => {
            setUrlIndex((current) => {
              const next = current + 1;
              if (next >= candidates.length) onExhausted();
              return next;
            });
          }}
        />
      </figure>
      <p className="ds-pin-photo-card__name ds-sans">{entityName}</p>
      {caption.creditText ? (
        <p id={creditId} className="ds-entity-photo__credit ds-pin-photo-card__credit ds-sans">
          {caption.creditText}
        </p>
      ) : null}
    </div>
  );
}
