/**
 * Optional rights-cleared primary image for learning-index entity pages.
 * Renders nothing when primaryImage is absent (no stock placeholders).
 */
import React from 'react';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed';

void React;

export type EntityPrimaryImageProps = {
  readonly image: PublicEntityPrimaryImageView;
  readonly entityName: string;
};

export function EntityPrimaryImage({ image, entityName }: EntityPrimaryImageProps) {
  return (
    <figure className="bb-entity-photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL may be external */}
      <img
        src={image.url}
        alt={image.alt || `Photograph related to ${entityName}`}
        width={image.width}
        height={image.height}
        className="bb-entity-photo__img"
        loading="lazy"
        decoding="async"
      />
      <figcaption className="bb-entity-photo__credit bb-sans">
        {image.credit}
        <span className="bb-mono"> · {image.rightsStatus.replace('_', ' ')}</span>
      </figcaption>
    </figure>
  );
}
