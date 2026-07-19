/**
 * Symbolic B&W archive collage for entities without a rights-cleared primaryImage.
 * Silhouette shapes (afro, fist, book, pin, arch) filled with mosaic tiles —
 * never presented as a portrait of the entity.
 */
import React from 'react';
import {
  ARCHIVE_COLLAGE_CAPTION,
  ARCHIVE_COLLAGE_SHAPE_META,
  archiveCollageAlt,
  selectArchiveCollageShape,
  type ArchiveCollageShape,
} from './archive-collage';
import { collageTilesForEntity } from './archive-collage-tiles';

void React;

export type EntityArchiveCollageProps = {
  readonly entityId: string;
  readonly entityName: string;
  readonly kind?: string;
};

export function EntityArchiveCollage({
  entityId,
  entityName,
  kind,
}: EntityArchiveCollageProps) {
  const shape = selectArchiveCollageShape(entityId, kind);
  const tiles = collageTilesForEntity(entityId);
  const alt = archiveCollageAlt({ entityName, shape });
  const clipId = `archive-collage-clip-${shape}-${hashSuffix(entityId)}`;
  const filterId = `archive-collage-bw-${hashSuffix(entityId)}`;

  return (
    <figure className="ds-entity-photo ds-entity-photo--collage">
      <div className="ds-entity-collage" role="img" aria-label={alt}>
        <svg
          className="ds-entity-collage__svg"
          viewBox="0 0 240 280"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <filter id={filterId} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="0.33 0.33 0.33 0 0
                        0.33 0.33 0.33 0 0
                        0.33 0.33 0.33 0 0
                        0    0    0    1 0"
              />
              <feComponentTransfer>
                <feFuncR type="linear" slope="1.15" intercept="-0.05" />
                <feFuncG type="linear" slope="1.15" intercept="-0.05" />
                <feFuncB type="linear" slope="1.15" intercept="-0.05" />
              </feComponentTransfer>
            </filter>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <CollageShapePath shape={shape} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`} filter={`url(#${filterId})`}>
            <rect width="240" height="280" fill="#161616" />
            {tiles.map((src, index) => {
              const col = index % 4;
              const row = Math.floor(index / 4);
              return (
                <image
                  key={`${src}-${index}`}
                  href={src}
                  x={col * 60}
                  y={row * 70}
                  width={60}
                  height={70}
                  preserveAspectRatio="xMidYMid slice"
                />
              );
            })}
          </g>
          {/* Hairline outline for shape clarity on paper canvas */}
          <g fill="none" stroke="#0A0A0A" strokeWidth="1.5" opacity="0.35">
            <CollageShapePath shape={shape} />
          </g>
        </svg>
      </div>
      <figcaption className="ds-entity-photo__credit ds-sans">
        {ARCHIVE_COLLAGE_CAPTION}
        <span className="ds-mono"> · {ARCHIVE_COLLAGE_SHAPE_META[shape].label}</span>
      </figcaption>
    </figure>
  );
}

function hashSuffix(entityId: string): string {
  return entityId.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'x';
}

function CollageShapePath({ shape }: { readonly shape: ArchiveCollageShape }) {
  switch (shape) {
    case 'afro':
      return (
        <path d="M120 272c-42 0-74-24-84-62-8-28-4-52 10-74 10-16 12-32 6-50-6-22 4-44 24-56 14-8 30-10 48-6 12-22 34-36 56-36s44 14 56 36c18-4 34-2 48 6 20 12 30 34 24 56-6 18-4 34 6 50 14 22 18 46 10 74-10 38-42 62-84 62H120z" />
      );
    case 'fist':
      return (
        <path d="M150 272H78v-78l-20-16C42 164 34 146 34 124V96c0-20 16-36 36-36 8 0 16 2 22 8 6-8 16-12 26-12 10 0 18 4 24 10 6-6 14-10 24-10 16 0 28 10 32 24h10c14 0 26 12 26 28 0 12-8 24-20 28l-26 10c-6 2-10 8-10 14v88zm-64-188c-8 0-14 6-14 14v28h28V98c0-8-6-14-14-14zm32-6c-8 0-14 6-14 14v36h28v-36c0-8-6-14-14-14zm32 4c-8 0-14 6-14 14v32h28v-32c0-8-6-14-14-14zm-80 22c-8 0-14 6-14 14v22h28v-22c0-8-6-14-14-14z" />
      );
    case 'book':
      return (
        <path d="M28 52c28-18 60-26 92-26s64 8 92 26v188c-28-14-60-22-92-22s-64 8-92 22V52zm92 8c-30 0-58 6-80 16v152c22-10 50-16 80-16V60zm0 0c30 0 58 6 80 16v152c-22-10-50-16-80-16V60z" />
      );
    case 'pin':
      return (
        <path
          fillRule="evenodd"
          d="M120 272S48 178 48 112a72 72 0 1 1 144 0c0 66-72 160-72 160zm0-124a36 36 0 1 0 0-72 36 36 0 0 0 0 72z"
        />
      );
    case 'arch':
      return (
        <path d="M40 272V120C40 64 78 24 120 24s80 40 80 96v152h-40V124c0-24-18-44-40-44s-40 20-40 44v148H40z" />
      );
    default: {
      const _exhaustive: never = shape;
      return _exhaustive;
    }
  }
}
