'use client';

import React, { useRef } from 'react';
import { usePhotoFit } from '../entity/use-photo-fit';

void React;

/**
 * A story's hero photograph, inside the masthead. Same rule as a record's masthead: cover-crop
 * only when the crop keeps most of the picture, otherwise show it whole over a blurred fill.
 */
export function ArticleHeroPhoto({ url, alt }: { readonly url: string; readonly alt: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fit = usePhotoFit(frameRef, imgRef, url);
  return (
    <div className="ds-article-mast__photo ds-fit-photo" ref={frameRef} data-fit={fit}>
      {fit === 'contain' ? (
        // eslint-disable-next-line @next/next/no-img-element -- decorative fill of the same photo
        <img className="ds-fit-photo__backdrop" src={url} alt="" aria-hidden="true" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- published hero, may be external */}
      <img ref={imgRef} className="ds-fit-photo__main" src={url} alt={alt} fetchPriority="high" />
    </div>
  );
}
