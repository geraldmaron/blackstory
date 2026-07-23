/**
 * Homepage beat 03: archive counts plus national census charts with /data hand-off.
 */

import React from 'react';
import Link from 'next/link';
import type { NationalPopulationTimelineSnapshot } from '@repo/domain/statistics/public-data-summaries';
import { PopulationByDecadeChart } from '../data/PopulationByDecadeChart';
import { BlackPopulationShareChart } from '../data/BlackPopulationShareChart';
import { HomeEditionHeader } from './HomeEditionHeader';

void React;

export type HomeDataPulseProps = {
  readonly recordCount: number;
  readonly stateCount: number;
  readonly eraSpan?: string | undefined;
  readonly timeline?: NationalPopulationTimelineSnapshot | undefined;
};

function displayEraSpan(eraSpan: string | undefined): string | undefined {
  if (!eraSpan) return undefined;
  return eraSpan.replace(/\u2013|\u2014/g, ' to ');
}

export function HomeDataPulse({ recordCount, stateCount, eraSpan, timeline }: HomeDataPulseProps) {
  const rows = timeline?.rows ?? [];
  const hasPopulation = rows.length > 0;
  const chartSources = (timeline?.sources ?? []).map((source) => ({
    label: source.label,
    url: source.sourceUrl,
  }));
  const eraDisplay = displayEraSpan(eraSpan);

  return (
    <section
      className="ds-home-edition__beat ds-home-edition__beat--deep"
      id="beat-c"
      aria-labelledby="home-data-heading"
    >
      <HomeEditionHeader
        index="03"
        kicker="What the numbers show"
        title="The numbers underneath the pins."
        lede="Archive scale beside national census context. Every figure carries its source. Population is context for place, not a substitute for it."
        id="home-data-heading"
      />

      <ul className="ds-data-strip" aria-label="Archive in numbers">
        <li className="ds-data-strip__item">
          <span className="ds-data-strip__value">{recordCount.toLocaleString('en-US')}</span>
          <span className="ds-data-strip__label">Records pinned</span>
        </li>
        <li className="ds-data-strip__item">
          <span className="ds-data-strip__value">{stateCount}</span>
          <span className="ds-data-strip__label">States on the map</span>
        </li>
        {eraDisplay ? (
          <li className="ds-data-strip__item">
            <span className="ds-data-strip__value">{eraDisplay}</span>
            <span className="ds-data-strip__label">Eras spanned</span>
          </li>
        ) : null}
      </ul>

      {hasPopulation ? (
        <div className="ds-home-edition__viz-pair">
          <PopulationByDecadeChart rows={rows} sources={chartSources} />
          <BlackPopulationShareChart rows={rows} sources={chartSources} />
        </div>
      ) : (
        <p className="ds-home-edition__data-fallback">
          National census figures are not available here yet. The data page lists every series and
          citation when the release carries them.
        </p>
      )}

      <p className="ds-home-edition__beat-cta">
        <Link className="ds-cta ds-cta--quiet" href="/data">
          Open the data page
        </Link>
      </p>
    </section>
  );
}
