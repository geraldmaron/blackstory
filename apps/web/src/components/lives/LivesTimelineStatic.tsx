import Link from 'next/link';
import React from 'react';
import { LIVES_AREAS, type LivesAreaBundle } from '@repo/domain/statistics/lives';
import { Segmented } from '@repo/ui';
import { DEFAULT_LIVES_VIEW, buildLivesHref } from '../../lib/lives/lives-url-state';
import { LivesClassArcChart } from './LivesClassArcChart';
import { LivesDecadePanel } from './LivesDecadePanel';

void React;

export type LivesTimelineStaticProps = {
  readonly bundle: LivesAreaBundle;
  readonly areaSlug: string;
};

/**
 * Server render of the default view: the area links, the class arc, every decade as a plain link
 * and the default decade's full panel. It is what a reader receives before the interactive
 * instrument hydrates.
 */
export function LivesTimelineStatic({ bundle, areaSlug }: LivesTimelineStaticProps) {
  const decade =
    bundle.decades.find((entry) => entry.decade === DEFAULT_LIVES_VIEW.decade) ??
    bundle.decades.at(-1);
  if (!decade) return null;
  return (
    <div className="lives-instrument">
      <div className="lives-toolbar">
        <div className="lives-toolbar__field">
          <span className="lives-toolbar__label">Area</span>
          <Segmented
            label="Area"
            linkAs={Link}
            value={areaSlug}
            options={LIVES_AREAS.map((entry) => ({
              value: entry.slug,
              label: entry.name,
              href: buildLivesHref(entry.slug, DEFAULT_LIVES_VIEW),
            }))}
          />
        </div>
      </div>
      <section className="lives-result" aria-label={bundle.areaName}>
        <LivesClassArcChart
          bundle={bundle}
          emphasis={DEFAULT_LIVES_VIEW.race}
          selectedDecade={decade.decade}
        />
        <nav className="lives-decade-links" aria-label="Decade">
          {bundle.decades.map((entry) => (
            <Link
              key={entry.decade}
              href={buildLivesHref(areaSlug, { ...DEFAULT_LIVES_VIEW, decade: entry.decade })}
              aria-current={entry.decade === decade.decade ? 'page' : undefined}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
        <LivesDecadePanel
          decade={decade}
          emphasis={DEFAULT_LIVES_VIEW.race}
          disclaimer={bundle.disclaimer}
        />
      </section>
    </div>
  );
}
