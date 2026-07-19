/**
 * Entity mast media with a fail-closed photo chain.
 * Tries the published primary URL, then GCS primary.* extension swaps; on total
 * failure (or absent image / Save-Data) renders the kind-derived EntityRecordMark —
 * never a broken <img> or collage mosaic. Alt text and mark names stay reason-accurate.
 */
'use client';

import React, { useEffect, useState } from 'react';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed';
import { buildEntityMastImageCandidates } from './entity-mast-image-candidates';
import { EntityRecordMark } from './EntityRecordMark';
import {
  entityPrimaryImageAlt,
  primaryImageCreditCaption,
  primaryImageFocalClass,
  type RecordMarkReason,
} from './record-mark';

void React;

export type EntityMastMediaProps = {
  readonly entityId: string;
  readonly entityName: string;
  readonly kind?: string;
  readonly jurisdictionLabel?: string;
  readonly primaryImage?: PublicEntityPrimaryImageView;
  /** When true (default), load the photo eagerly for above-the-fold mast placement. */
  readonly priority?: boolean;
};

type MastPhase =
  | { readonly kind: 'mark'; readonly reason: RecordMarkReason }
  | { readonly kind: 'photo'; readonly urlIndex: number; readonly urls: readonly string[] };

function initialPhase(primaryImage: PublicEntityPrimaryImageView | undefined): MastPhase {
  if (!primaryImage?.url.trim()) {
    return { kind: 'mark', reason: 'absent' };
  }
  const urls = buildEntityMastImageCandidates(primaryImage.url);
  if (urls.length === 0) {
    return { kind: 'mark', reason: 'absent' };
  }
  return { kind: 'photo', urlIndex: 0, urls };
}

export function EntityMastMedia({
  entityId,
  entityName,
  kind,
  jurisdictionLabel,
  primaryImage,
  priority = true,
}: EntityMastMediaProps) {
  const [phase, setPhase] = useState<MastPhase>(() => initialPhase(primaryImage));

  useEffect(() => {
    setPhase(initialPhase(primaryImage));
  }, [primaryImage]);

  useEffect(() => {
    const saveData =
      typeof navigator !== 'undefined' &&
      'connection' in navigator &&
      Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
      );
    if (!saveData || !primaryImage?.url.trim()) {
      return;
    }
    setPhase({ kind: 'mark', reason: 'prefer_mark' });
  }, [primaryImage]);

  if (phase.kind === 'mark') {
    return (
      <EntityRecordMark
        entityId={entityId}
        entityName={entityName}
        reason={phase.reason}
        {...(kind !== undefined ? { kind } : {})}
        {...(jurisdictionLabel !== undefined ? { jurisdictionLabel } : {})}
      />
    );
  }

  const image = primaryImage!;
  const src = phase.urls[phase.urlIndex]!;
  const alt = entityPrimaryImageAlt(image.alt, entityName);
  const creditId = `entity-photo-credit-${entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'x'}`;
  const caption = primaryImageCreditCaption({
    credit: image.credit,
    rightsStatus: image.rightsStatus,
  });
  const focalClass = primaryImageFocalClass(kind);

  return (
    <figure className={`ds-entity-photo ${focalClass}`} aria-describedby={creditId}>
      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL may be external */}
      <img
        key={src}
        src={src}
        alt={alt}
        width={image.width}
        height={image.height}
        className="ds-entity-photo__img"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        onError={() => {
          setPhase((current) => {
            if (current.kind !== 'photo') {
              return current;
            }
            const next = current.urlIndex + 1;
            if (next >= current.urls.length) {
              return { kind: 'mark', reason: 'exhausted' };
            }
            return { kind: 'photo', urlIndex: next, urls: current.urls };
          });
        }}
      />
      <figcaption id={creditId} className="ds-entity-photo__credit ds-sans">
        {caption.creditText}
        {caption.showRightsLabel ? (
          <span className="ds-mono">
            {caption.creditText ? ' · ' : ''}
            {caption.rightsLabel}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
