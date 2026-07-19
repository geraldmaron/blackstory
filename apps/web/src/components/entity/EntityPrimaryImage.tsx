/**
 * Bare rights-cleared primary image (no load-error fallback).
 * Entity mast pages should use EntityMastMedia, which chains URL candidates and
 * fails closed to EntityRecordMark. Keep this for non-mast embeds that already
 * own their own fallback policy.
 */
import React from 'react';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed';
import { entityPrimaryImageAlt, primaryImageRightsLabel } from './record-mark';

void React;

export type EntityPrimaryImageProps = {
  readonly image: PublicEntityPrimaryImageView;
  readonly entityName: string;
  /** When true (default), load eagerly for above-the-fold mast placement. */
  readonly priority?: boolean;
};

export function EntityPrimaryImage({
  image,
  entityName,
  priority = true,
}: EntityPrimaryImageProps) {
  const alt = entityPrimaryImageAlt(image.alt, entityName);

  return (
    <figure className="ds-entity-photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL may be external */}
      <img
        src={image.url}
        alt={alt}
        width={image.width}
        height={image.height}
        className="ds-entity-photo__img"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
      <figcaption className="ds-entity-photo__credit ds-sans">
        {image.credit}
        <span className="ds-mono"> · {primaryImageRightsLabel(image.rightsStatus)}</span>
      </figcaption>
    </figure>
  );
}
