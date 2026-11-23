/**
 * A record's own rights-cleared photograph, or nothing.
 *
 * `plate` shows the same photograph as a plate (docs/ui/archive/patterns-living-archive.md): toned in ink
 * and copper by CSS (`.ds-plate`, packages/ui components.css), cover-fit to the box it leads, with
 * the same credit line beside it, unaltered. Only ever a real, sourced photograph; never on the
 * memorial or a sensitive or violence-adjacent record (callers decide; those show it plain).
 *
 * Tries the published URL, then the stored extension swaps; when every candidate fails it
 * renders nothing at all. A record without a photograph shows no placeholder plate: a kind mark
 * dressed as imagery claims the archive has a picture it does not have.
 *
 * `width` is the slot's CSS width: a Commons image is asked for at the nearest thumbnail step
 * (`storyImageSrc`), so a 400px column never ships a 2,000px scan. Other hosts pass through.
 *
 * An image its own alt text calls an artist's impression or rendering is not a photograph: it
 * never becomes a plate, and it says what it is above its credit.
 */
'use client';

import React, { useState } from 'react';
import { ExhibitFrame } from '@repo/ui';
import type { PublicEntityPrimaryImageView } from '../../data/public-seed';
import { buildEntityMastImageCandidates } from './entity-mast-image-candidates';
import { RecordPhotoCredit } from './EntityMastMedia';
import { entityPrimaryImageAlt } from './record-mark';
import { storyImageSrc } from '../story/story-image';
import { isRenderedImage } from './rendered-image';

void React;

export function RecordImage({
  entityId,
  entityName,
  image,
  plate: asPlate = false,
  width,
  className,
}: {
  readonly entityId: string;
  readonly entityName: string;
  readonly image: PublicEntityPrimaryImageView;
  readonly plate?: boolean;
  /** The slot's CSS width, for a Commons thumbnail near it. */
  readonly width?: number;
  readonly className?: string;
}) {
  const rendered = isRenderedImage(image);
  const plate = asPlate && !rendered;
  const sized = width ? storyImageSrc(image.url, width, image.width) : image.url;
  const urls = [
    ...new Set([
      ...(sized !== image.url ? [sized] : []),
      ...buildEntityMastImageCandidates(image.url),
    ]),
  ];
  const [index, setIndex] = useState(0);
  const src = urls[index];
  if (src === undefined) return null;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- public CDN URL may be external
    <img
      key={src}
      src={src}
      alt={entityPrimaryImageAlt(image.alt, entityName)}
      width={image.width}
      height={image.height}
      className={plate ? 'ds-plate__img' : 'ds-recpage__photo-img'}
      decoding="async"
      fetchPriority="high"
      onError={() => setIndex((current) => current + 1)}
    />
  );
  // A real photograph outside the plate is an exhibit (docs/ui/DESIGN.md section 7.3): crop marks,
  // a label that says its date is not on record (the archive does not store one), and its credit
  // as the receipt. An artist's rendering keeps its own caption below.
  if (!plate && !rendered) {
    return (
      <ExhibitFrame
        id={`${entityId}-photograph`}
        kind="photograph"
        basis="date not on record"
        receipt={<RecordPhotoCredit entityId={entityId} image={image} />}
        {...(className ? { className } : {})}
      >
        {img}
      </ExhibitFrame>
    );
  }
  return (
    <figure
      className={[plate ? 'ds-plate' : 'ds-recpage__photo', className].filter(Boolean).join(' ')}
    >
      {plate ? <span className="ds-plate__tone">{img}</span> : img}
      {rendered ? (
        <figcaption className="ds-entity-photo__caption">
          <span className="ds-entity-photo__kind">Artist&rsquo;s rendering, not a photograph</span>
          <RecordPhotoCredit entityId={entityId} image={image} />
        </figcaption>
      ) : (
        <RecordPhotoCredit
          entityId={entityId}
          image={image}
          as="figcaption"
          {...(plate ? { className: 'ds-plate__credit' } : {})}
        />
      )}
    </figure>
  );
}
