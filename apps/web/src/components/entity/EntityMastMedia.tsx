/**
 * Entity mast media with a fail-closed photo chain.
 * Tries the published primary URL, then GCS primary.* extension swaps; on total
 * failure (or absent image / Save-Data) renders the kind-derived EntityRecordMark —
 * never a broken <img> or collage mosaic. Alt text and mark names stay reason-accurate.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed';
import { buildEntityMastImageCandidates } from './entity-mast-image-candidates';
import { EntityRecordMark } from './EntityRecordMark';
import {
  entityPrimaryImageAlt,
  isPortraitPrimaryImage,
  primaryImageCreditCaption,
  primaryImageFocalClass,
  primaryImageSourceLine,
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
  /** First paint: no rights-clearance or missing-photo caption. The mast is the place. */
  readonly hideCredit?: boolean;
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
  hideCredit = false,
}: EntityMastMediaProps) {
  const [phase, setPhase] = useState<MastPhase>(() => initialPhase(primaryImage));
  // Known up front whenever the catalog recorded the source dimensions. Pinned Wikimedia
  // thumbnails (fetched by the reader's own browser) do not carry them ahead of render, so this
  // starts optimistic (false) and the tracked <img>'s onLoad below corrects it once the real
  // pixels are known, rather than risk a cover-crop that could cut off the subject.
  const [portrait, setPortrait] = useState(() =>
    isPortraitPrimaryImage(primaryImage?.width, primaryImage?.height),
  );
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setPhase(initialPhase(primaryImage));
    setPortrait(isPortraitPrimaryImage(primaryImage?.width, primaryImage?.height));
  }, [primaryImage]);

  // A cached image can finish loading before this effect (or the onLoad prop below) attaches:
  // the browser fires its native `load` event on its own schedule, not React's. Checking
  // `.complete` here catches that race; onLoad below covers the image that is still in flight.
  useEffect(() => {
    const el = imgRef.current;
    if (!el || portrait || !el.complete) return;
    if (isPortraitPrimaryImage(el.naturalWidth, el.naturalHeight)) {
      setPortrait(true);
    }
  });

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
        {...(hideCredit ? { hideCaption: true } : {})}
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
  const sourceLine = primaryImageSourceLine({
    ...(image.sourceSystem !== undefined ? { sourceSystem: image.sourceSystem } : {}),
    ...(image.sourcePageUrl !== undefined ? { sourcePageUrl: image.sourcePageUrl } : {}),
    ...(image.license !== undefined ? { license: image.license } : {}),
  });
  const focalClass = primaryImageFocalClass(kind);
  const orientationClass = portrait ? ' ds-entity-photo--portrait' : '';

  return (
    <figure
      className={`ds-entity-photo ${focalClass}${orientationClass}`}
      {...(hideCredit ? {} : { 'aria-describedby': creditId })}
    >
      {portrait ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative blurred fill of the same photo, never the tracked/error-handled one
        <img
          key={`${src}-backdrop`}
          src={src}
          alt=""
          aria-hidden="true"
          className="ds-entity-photo__backdrop"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL may be external */}
      <img
        key={src}
        ref={imgRef}
        src={src}
        alt={alt}
        width={image.width}
        height={image.height}
        className="ds-entity-photo__img"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        onLoad={(event) => {
          if (portrait) return;
          const el = event.currentTarget;
          if (isPortraitPrimaryImage(el.naturalWidth, el.naturalHeight)) {
            setPortrait(true);
          }
        }}
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
      {hideCredit ? null : (
        <figcaption id={creditId} className="ds-entity-photo__credit ds-sans">
          {caption.creditText}
          {caption.showRightsLabel ? (
            <span className="ds-mono">
              {caption.creditText ? ' · ' : ''}
              {caption.rightsLabel}
            </span>
          ) : null}
          {sourceLine ? (
            <a
              href={sourceLine.url}
              className="ds-entity-photo__source-link ds-mono"
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {caption.creditText || caption.showRightsLabel ? ' · ' : ''}
              {sourceLine.label}
            </a>
          ) : null}
        </figcaption>
      )}
    </figure>
  );
}
