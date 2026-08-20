/**
 * Book cover thumbnail with fail-closed placeholder when ISBN is missing or the
 * Open Library cover request fails. Decorative in browse rip rows; labeled on detail.
 */
'use client';

import React, { useState } from 'react';
import { openLibraryCoverUrl, coverInitialsForTitle } from './books-cover';

void React;

export type BooksCoverArtProps = {
  readonly title: string;
  readonly isbn?: string;
  readonly size?: 'S' | 'M' | 'L';
  readonly decorative?: boolean;
  readonly className?: string;
};

export function BooksCoverArt({
  title,
  isbn,
  size = 'M',
  decorative = true,
  className,
}: BooksCoverArtProps) {
  const [failed, setFailed] = useState(false);
  const rootClass = ['ds-books-edition__cover', className].filter(Boolean).join(' ');

  if (!isbn?.trim() || failed) {
    const initials = coverInitialsForTitle(title);
    return (
      <figure
        className={`${rootClass} ds-books-edition__cover--placeholder`}
        aria-hidden={decorative ? true : undefined}
        {...(decorative ? {} : { 'aria-label': `Cover unavailable for ${title}` })}
      >
        <span className="ds-books-edition__cover-initials" aria-hidden="true">
          {initials}
        </span>
      </figure>
    );
  }

  const alt = decorative ? '' : `Cover of ${title}`;

  return (
    <figure className={rootClass}>
      {/* Open Library remote covers need client onError fallback; next/image remote patterns are out of scope here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="ds-books-edition__cover-img"
        src={openLibraryCoverUrl(isbn, size)}
        alt={alt}
        width={size === 'L' ? 180 : size === 'M' ? 120 : 80}
        height={size === 'L' ? 270 : size === 'M' ? 180 : 120}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    </figure>
  );
}
