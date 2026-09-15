import Link from 'next/link';
import React from 'react';
import type { LivesRegionBundle } from '@repo/domain/statistics/lives';
import { DEFAULT_LIVES_VIEW, buildLivesHref } from '../../lib/lives/lives-url-state';
import { LivesDecadePanel } from './LivesDecadePanel';

void React;

export type LivesTimelineStaticProps = {
  readonly bundle: LivesRegionBundle;
  readonly regionSlug: string;
};

/**
 * Server render of the default view: every decade as a plain link and the first decade's full
 * panel. It is what a reader without JavaScript, and a crawler, receives; the interactive timeline
 * replaces it after hydration.
 */
export function LivesTimelineStatic({ bundle, regionSlug }: LivesTimelineStaticProps) {
  const decade =
    bundle.decades.find((entry) => entry.decade === DEFAULT_LIVES_VIEW.decade) ?? bundle.decades[0];
  if (!decade) return null;
  return (
    <div className="lives-timeline">
      <nav className="lives-rail lives-rail--static" aria-label="Decade">
        {bundle.decades.map((entry) => (
          <Link
            key={entry.decade}
            className="lives-rail__tab"
            href={buildLivesHref(regionSlug, { ...DEFAULT_LIVES_VIEW, decade: entry.decade })}
            aria-current={entry.decade === decade.decade ? 'page' : undefined}
            data-boundary={entry.boundaryFromPrevious}
          >
            <span className="lives-rail__label">{entry.label}</span>
          </Link>
        ))}
      </nav>
      <LivesDecadePanel
        decade={decade}
        emphasis={DEFAULT_LIVES_VIEW.race}
        tier={DEFAULT_LIVES_VIEW.tier}
        disclaimer={bundle.disclaimer}
      />
    </div>
  );
}
