/**
 * Homepage data pulse — archive counts plus national census visualizations reused
 * from `/data`, with a clear hand-off to the full modeling page and citations.
 */

import React from 'react';
import Link from 'next/link';
import type {
  NationalPopulationByDecade,
  PopulationDecadeChange,
} from '@repo/firebase';
import { DataStatStrip } from '../data/DataStatStrip';
import { PopulationByDecadeChart } from '../data/PopulationByDecadeChart';
import { BlackPopulationShareChart } from '../data/BlackPopulationShareChart';
import { nationalChangeStripItems } from '../data/population-change';

void React;

export type HomeDataPulseProps = {
  readonly recordCount: number;
  readonly stateCount: number;
  /** e.g. "1820s–1970s"; omitted when the release carries no dated records. */
  readonly eraSpan?: string | undefined;
  readonly populationByDecade?: readonly NationalPopulationByDecade[] | undefined;
  readonly populationChanges?: readonly PopulationDecadeChange[] | undefined;
};

export function HomeDataPulse({
  recordCount,
  stateCount,
  eraSpan,
  populationByDecade,
  populationChanges,
}: HomeDataPulseProps) {
  const hasPopulation = Boolean(populationByDecade && populationByDecade.length > 0);
  const changeStripItems = populationChanges ? nationalChangeStripItems(populationChanges) : [];

  return (
    <section className="ds-section ds-home-data-pulse" aria-labelledby="home-data-heading">
      <p className="ds-section__kicker">From the data</p>
      <h2 className="ds-section__title" id="home-data-heading">
        The numbers underneath the pins.
      </h2>
      <p className="ds-section__lede">
        Archive scale from the active release, beside national census rollups that give population
        context for the map — each figure carrying its source.
      </p>

      <ul className="ds-data-strip" aria-label="Archive in numbers">
        <li className="ds-data-strip__item">
          <span className="ds-data-strip__value">{recordCount}</span>
          <span className="ds-data-strip__label">Records pinned</span>
        </li>
        <li className="ds-data-strip__item">
          <span className="ds-data-strip__value">{stateCount}</span>
          <span className="ds-data-strip__label">States on the map</span>
        </li>
        {eraSpan ? (
          <li className="ds-data-strip__item">
            <span className="ds-data-strip__value">{eraSpan}</span>
            <span className="ds-data-strip__label">Eras spanned</span>
          </li>
        ) : null}
      </ul>

      {hasPopulation && populationByDecade ? (
        <div className="ds-home-data-pulse__viz">
          <div className="ds-data-section__viz ds-data-section__viz--pair">
            <PopulationByDecadeChart rows={populationByDecade} />
            <BlackPopulationShareChart rows={populationByDecade} />
          </div>
          {changeStripItems.length > 0 ? (
            <div className="ds-home-data-pulse__changes">
              <h3 className="ds-home-data-pulse__subhead" id="home-population-change-heading">
                Decade-over-decade change
              </h3>
              <DataStatStrip
                labelledBy="home-population-change-heading"
                items={changeStripItems}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="ds-sans ds-home-data-pulse__fallback">
          National census rollups are not available in this environment yet. The full modeling
          page lists every series and citation when the release carries them.
        </p>
      )}

      <p className="ds-home-data-pulse__cta">
        <Link className="ds-cta ds-cta--quiet" href="/data">
          Open the data page
        </Link>
      </p>
    </section>
  );
}
