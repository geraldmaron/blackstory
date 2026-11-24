import Link from 'next/link';
import React from 'react';
import { LIVES_AREAS, type LivesAreaBundle } from '@repo/domain/statistics/lives';
import { Segmented } from '@repo/ui';
import { buildLivesHref, type LivesViewState } from '../../lib/lives/lives-url-state';
import { LivesClassArcFigure, type LivesFigureFrame } from './LivesFigures';
import { LivesDecadePanel } from './LivesDecadePanel';

void React;

export type LivesTimelineStaticProps = {
  readonly bundle: LivesAreaBundle;
  readonly areaSlug: string;
  /** The decade and the emphasized group the address asks for. */
  readonly state: LivesViewState;
  readonly frame: Omit<LivesFigureFrame, 'areaSlug' | 'state'>;
};

/**
 * Server render of the view the address asks for: the area links, the class arc, every decade as a
 * plain link and that decade's full panel. It is what a reader receives before the interactive
 * instrument hydrates, and all a reader without JavaScript receives, so the decade links and the
 * figures' view links have to work from the address alone.
 */
export function LivesTimelineStatic({ bundle, areaSlug, state, frame }: LivesTimelineStaticProps) {
  const decade =
    bundle.decades.find((entry) => entry.decade === state.decade) ?? bundle.decades.at(-1);
  if (!decade) return null;
  const figureFrame = { ...frame, areaSlug, state };
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
              href: buildLivesHref(entry.slug, state),
            }))}
          />
        </div>
      </div>
      <section className="lives-result" aria-label={bundle.areaName}>
        <LivesClassArcFigure
          bundle={bundle}
          emphasis={state.race}
          selectedDecade={decade.decade}
          frame={figureFrame}
        />
        <nav className="lives-decade-links" aria-label="Decade">
          {bundle.decades.map((entry) => (
            <Link
              key={entry.decade}
              href={buildLivesHref(areaSlug, { ...state, decade: entry.decade })}
              aria-current={entry.decade === decade.decade ? 'page' : undefined}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
        <LivesDecadePanel
          decade={decade}
          emphasis={state.race}
          disclaimer={bundle.disclaimer}
          frame={figureFrame}
        />
      </section>
    </div>
  );
}
