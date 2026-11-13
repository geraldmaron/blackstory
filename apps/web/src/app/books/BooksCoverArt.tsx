/**
 * A book cover at its true 2:3 proportion. The real art loads from Open Library over a paper
 * ground; with no ISBN, or when the request fails, the cover is typeset instead (the title in
 * the display face, the author under it), never a monogram or an empty box.
 *
 * Decorative by default, because the link around it already carries the title; the detail page
 * labels it.
 */
'use client';

import React, { useState } from 'react';
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
  const [failed, setFailed] = useState(false);
  const rootClass = ['ds-book-cover', className].filter(Boolean).join(' ');

  if (!isbn?.trim() || failed) {
    return (
      <figure
        className={`${rootClass} ds-book-cover--typeset`}
        aria-hidden={decorative ? true : undefined}
        {...(decorative ? {} : { 'aria-label': `Cover unavailable for ${title}` })}
      >
        <span className="ds-book-cover__title">{title}</span>
        {author ? <span className="ds-book-cover__author">{author}</span> : null}
      </figure>
    );
  }

  return (
    <figure className={rootClass} aria-hidden={decorative ? true : undefined}>
      {/* Open Library remote covers need client onError fallback; next/image remote patterns are out of scope here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ds-book-cover__img"
        src={openLibraryCoverUrl(isbn, size)}
        alt={decorative ? '' : `Cover of ${title}`}
        width={size === 'L' ? 180 : size === 'M' ? 120 : 80}
        height={size === 'L' ? 270 : size === 'M' ? 180 : 120}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </figure>
  );
}
