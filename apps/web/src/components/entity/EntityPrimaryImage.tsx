/**
 * Optional rights-cleared primary image for learning-index entity pages.
 * When absent, the entity page renders EntityArchiveCollage instead.
 * Mast mounts use eager loading; aside/deferred mounts may pass priority={false}.
 */
import React from 'react';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed';

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
  return (
    <figure className="ds-entity-photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL may be external */}
      <img
        src={image.url}
        alt={image.alt || `Photograph related to ${entityName}`}
        width={image.width}
        height={image.height}
        className="ds-entity-photo__img"
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
      />
      <figcaption className="ds-entity-photo__credit ds-sans">
        {image.credit}
        <span className="ds-mono"> · {image.rightsStatus.replace('_', ' ')}</span>
      </figcaption>
    </figure>
  );
}
