import Link from 'next/link';
import React from 'react';
import { LIVES_NATIONAL, livesAreaBySlug } from '@repo/domain/statistics/lives';
import {
  DEFAULT_LIVES_VIEW,
  buildLivesHref,
  type LivesViewState,
} from '../../lib/lives/lives-url-state';

void React;

const REGION_MAP_ORDER = [
  'west',
  'midwest',
  'northeast',
  'texas-oklahoma',
  'upper-south',
  'deep-south',
] as const;

export type LivesAreaNavProps = {
  readonly currentSlug: string;
  readonly view?: LivesViewState;
};

/**
 * Schematic region map: the national baseline as a bar, then six regions in a rough US layout.
 * Links load a new snapshot; they are not client-only filters.
 */
export function LivesAreaNav({ currentSlug, view }: LivesAreaNavProps) {
  const state = view ?? DEFAULT_LIVES_VIEW;
  return (
    <nav className="lives-region-map" aria-label="Area">
      <Link
        href={buildLivesHref(LIVES_NATIONAL.slug, state)}
        className="lives-region-map__nation"
        aria-current={currentSlug === LIVES_NATIONAL.slug ? 'page' : undefined}
      >
        <span className="lives-region-map__name">{LIVES_NATIONAL.name}</span>
        <span className="lives-region-map__summary">{LIVES_NATIONAL.summary}</span>
      </Link>
      <div className="lives-region-map__grid">
        {REGION_MAP_ORDER.map((slug) => {
          const area = livesAreaBySlug(slug);
          if (!area) return null;
          return (
            <Link
              key={area.id}
              href={buildLivesHref(area.slug, state)}
              className="lives-region-map__cell"
              aria-current={area.slug === currentSlug ? 'page' : undefined}
            >
              <span className="lives-region-map__name">{area.name}</span>
              <span className="lives-region-map__summary">{area.summary}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
