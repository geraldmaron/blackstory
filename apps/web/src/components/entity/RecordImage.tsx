/**
 * A record's own rights-cleared photograph, or nothing.
 *
 * Tries the published URL, then the stored extension swaps; when every candidate fails it
 * renders nothing at all. A record without a photograph shows no placeholder plate: a kind mark
 * dressed as imagery claims the archive has a picture it does not have.
 */
'use client';

import React, { useState } from 'react';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed';
import { buildEntityMastImageCandidates } from './entity-mast-image-candidates';
import { RecordPhotoCredit } from './EntityMastMedia';
import { entityPrimaryImageAlt } from './record-mark';

void React;

export function RecordImage({
  entityId,
  entityName,
  image,
}: {
  readonly entityId: string;
  readonly entityName: string;
  readonly image: PublicEntityPrimaryImageView;
}) {
  const urls = buildEntityMastImageCandidates(image.url);
  const [index, setIndex] = useState(0);
  const src = urls[index];
  if (src === undefined) return null;

  return (
    <figure className="ds-recpage__photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- public CDN URL may be external */}
      <img
        key={src}
        src={src}
        alt={entityPrimaryImageAlt(image.alt, entityName)}
        width={image.width}
        height={image.height}
        className="ds-recpage__photo-img"
        decoding="async"
        fetchPriority="high"
        onError={() => setIndex((current) => current + 1)}
      />
      <RecordPhotoCredit entityId={entityId} image={image} as="figcaption" />
    </figure>
  );
}
