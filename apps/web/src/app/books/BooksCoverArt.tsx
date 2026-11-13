/**
 * A book cover at its true 2:3 proportion. The cover is typeset first, on sand (the title in the
 * display face, the author under it), and the Open Library art replaces it once it has loaded, on
 * a paper mat. With no ISBN, or when the request fails, the typeset cover stays: never a monogram,
 * an empty box, or a blank frame while a lazy image waits to be scrolled to.
 *
 * Decorative by default, because the link around it already carries the title; the detail page
 * labels it.
 */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { openLibraryCoverUrl } from './books-cover';
import './book-cover.css';

void React;

export type BooksCoverArtProps = {
  readonly title: string;
  /** Printed on the typeset cover under the title. */
  readonly author?: string;
  readonly isbn?: string;
  readonly size?: 'S' | 'M' | 'L';
  readonly decorative?: boolean;
  readonly className?: string;
};

export function BooksCoverArt({
  title,
  author,
  isbn,
  size = 'M',
  decorative = true,
  className,
}: BooksCoverArtProps) {
  const [art, setArt] = useState<'pending' | 'loaded' | 'failed'>('pending');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rootClass = ['ds-book-cover', className].filter(Boolean).join(' ');
  const hasIsbn = !!isbn?.trim();

  // An image already in the cache can finish before hydration attaches onLoad.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) setArt(img.naturalWidth > 0 ? 'loaded' : 'failed');
  }, [isbn]);

  const typeset = (
    <>
      <span className="ds-book-cover__title">{title}</span>
      {author ? <span className="ds-book-cover__author">{author}</span> : null}
    </>
  );

  if (!hasIsbn || art === 'failed') {
    return (
      <figure
        className={`${rootClass} ds-book-cover--typeset`}
        data-ground="sand"
        aria-hidden={decorative ? true : undefined}
        {...(decorative ? {} : { 'aria-label': `Cover unavailable for ${title}` })}
      >
        {typeset}
      </figure>
    );
  }

  const loaded = art === 'loaded';
  return (
    <figure
      className={loaded ? rootClass : `${rootClass} ds-book-cover--typeset`}
      {...(loaded ? {} : { 'data-ground': 'sand' })}
      data-art={art}
      aria-hidden={decorative ? true : undefined}
    >
      {loaded ? null : typeset}
      {/* Open Library remote covers need client onError fallback; next/image remote patterns are out of scope here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        className="ds-book-cover__img"
        src={openLibraryCoverUrl(isbn!, size)}
        alt={decorative ? '' : `Cover of ${title}`}
        width={size === 'L' ? 180 : size === 'M' ? 120 : 80}
        height={size === 'L' ? 270 : size === 'M' ? 180 : 120}
        loading="lazy"
        decoding="async"
        onLoad={() => setArt('loaded')}
        onError={() => setArt('failed')}
      />
    </figure>
  );
}
