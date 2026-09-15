import Link from 'next/link';
import React from 'react';
import { LIVES_AREAS } from '@repo/domain/statistics/lives';

void React;

export type LivesAreaNavProps = {
  readonly currentSlug: string;
};

/** Links between the national baseline and the six regions. */
export function LivesAreaNav({ currentSlug }: LivesAreaNavProps) {
  return (
    <nav className="lives-area-nav" aria-label="Area">
      {LIVES_AREAS.map((area) => (
        <Link
          key={area.id}
          href={`/lives/${area.slug}`}
          className="lives-area-nav__link"
          aria-current={area.slug === currentSlug ? 'page' : undefined}
        >
          {area.name}
        </Link>
      ))}
    </nav>
  );
}
