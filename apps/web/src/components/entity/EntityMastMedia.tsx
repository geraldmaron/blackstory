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
import { usePhotoFit } from './use-photo-fit';
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
  /**
   * Omit the in-photo caption. Record masts pass this and render `RecordPhotoCredit` in the
   * overlay instead, so rights text never sits on top of the lede.
   */
  readonly hideCredit?: boolean;
};

function photoCreditId(entityId: string): string {
  return `entity-photo-credit-${entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'x'}`;
}

/** Rights line for a pinned photograph. Record masts place this under the lede, in flow. */
export function RecordPhotoCredit({
  entityId,
  image,
  as: Tag = 'p',
  className,
}: {
  readonly entityId: string;
  readonly image: PublicEntityPrimaryImageView;
  readonly as?: 'p' | 'figcaption';
  readonly className?: string;
}) {
  const creditId = photoCreditId(entityId);
  const caption = primaryImageCreditCaption({
    credit: image.credit,
    rightsStatus: image.rightsStatus,
  });
  const sourceLine = primaryImageSourceLine({
    ...(image.sourceSystem !== undefined ? { sourceSystem: image.sourceSystem } : {}),
    ...(image.sourcePageUrl !== undefined ? { sourcePageUrl: image.sourcePageUrl } : {}),
    ...(image.license !== undefined ? { license: image.license } : {}),
  });
  const classes = ['ds-entity-photo__credit', 'ds-sans', className].filter(Boolean).join(' ');

  return (
    <Tag id={creditId} className={classes}>
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
    </Tag>
  );
}

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
  // Whether to keep the whole photograph (contain over a blurred fill of itself) instead of
  // cover-cropping it. Decided against the figure's *actual* box, not a fixed portrait rule: a
  // square or 4:3 photo is not portrait, but in a 2.8:1 banner a cover crop still threw away half
  // of it — usually the top of someone's head. Unknown dimensions start contained (nothing is
  // ever cut before we know), and the real pixels and box decide after load and on resize.
  const imgRef = useRef<HTMLImageElement>(null);
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPhase(initialPhase(primaryImage));
  }, [primaryImage]);

  const fit = usePhotoFit(
    figureRef,
    imgRef,
    phase.kind === 'photo' ? phase.urls[phase.urlIndex] : null,
    primaryImage?.width && primaryImage?.height
      ? isPortraitPrimaryImage(primaryImage.width, primaryImage.height)
        ? 'contain'
        : 'cover'
      : 'contain',
    { width: primaryImage?.width, height: primaryImage?.height },
  );
  const contained = fit === 'contain';

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
  const creditId = photoCreditId(entityId);
  const focalClass = primaryImageFocalClass(kind);
  // `--portrait` is the long-standing hook for the contain-over-blur treatment; it now means
  // "contained", whatever the photo's own orientation.
  const orientationClass = contained ? ' ds-entity-photo--portrait ds-entity-photo--contain' : '';

  return (
    <figure
      ref={figureRef}
      data-fit={contained ? 'contain' : 'cover'}
      className={`ds-entity-photo ${focalClass}${orientationClass}`}
      {...(hideCredit ? {} : { 'aria-describedby': creditId })}
    >
      {contained ? (
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
      {hideCredit ? null : <RecordPhotoCredit entityId={entityId} image={image} as="figcaption" />}
    </figure>
  );
}
