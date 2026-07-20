/**
 * Data page: the modeling built on top of the archive — census population, ACS estimates,
 * FBI hate crime reporting, and Opportunity Atlas economic-mobility coverage — shown as
 * national rollups with mandatory source citations (public-numeric-policy category 3).
 *
 * Population section: one chart of decennial levels (counts + share annotation) plus a strip
 * of decade-over-decade Δ Black / Δ share and a state movers list — not a triple listing of
 * the same levels. County choropleth detail lives on Explore map layer models.
 *
 * HOLC (Mapping Inequality) is deliberately absent — CC BY-NC-SA rights hold.
 *
 * Page chrome (TOC, beats, numbered sections, CTAs) lives in DataSections; charts stay in
 * components/data.
 */
import { US_STATES } from '@repo/domain/map/geography';
import {
  buildStateFipsNameMap,
  getAcsCoverageSummary,
  getHateCrimeYearSummaries,
  getHateCrimeYearSummary,
  getHistoricalStatePopulationCoverage,
  getNationalPopulationTimelineSnapshot,
  getOpportunityAtlasCoverageSummary,
  getStatePopulationChanges,
  type AcsCoverageSummary,
  type HateCrimeYearSummary,
  type HistoricalStatePopulationCoverage,
  type NationalPopulationTimelineSnapshot,
  type OpportunityAtlasCoverageSummary,
  type StatePopulationChange,
} from '@repo/firebase';
import { timelineChangeStripItems } from '../../components/data/population-change';
import '../../components/data/data-charts.css';
import { DataSections } from './DataSections';

export const metadata = {
  title: 'Data',
  description:
    'Census, ACS, FBI hate crime, and economic-mobility modeling behind the archive — national rollups with full source citations.',
};

/** Most recent data year with a complete annual FBI UCR release at time of writing. */
const LATEST_HATE_CRIME_YEAR = '2024';

/** Years shown on the multi-year reporting metrics chart — each year fetched separately. */
const HATE_CRIME_SERIES_YEARS = ['2010', '2015', '2020', '2021', '2022', '2023', '2024'] as const;

async function safe<T>(promise: Promise<T | undefined | null>): Promise<T | undefined> {
  try {
    const value = await promise;
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

const STATE_NAME_BY_FIPS = buildStateFipsNameMap(US_STATES);

export default async function DataPage() {
  const [
    timelineSnapshot,
    stateChanges2010to2020,
    historicalStateCoverage,
    acsCoverage,
    hateCrimeYear,
    hateCrimeSeries,
    opportunityAtlasCoverage,
  ] = await Promise.all([
    safe(getNationalPopulationTimelineSnapshot()),
    safe(getStatePopulationChanges('2010', '2020')),
    safe(getHistoricalStatePopulationCoverage()),
    safe(getAcsCoverageSummary()),
    safe(getHateCrimeYearSummary(LATEST_HATE_CRIME_YEAR)),
    safe(getHateCrimeYearSummaries(HATE_CRIME_SERIES_YEARS)),
    safe(getOpportunityAtlasCoverageSummary()),
  ]);

  const hateCrime = hateCrimeYear as HateCrimeYearSummary | undefined;
  const hateCrimeByYear = (hateCrimeSeries ?? []) as readonly HateCrimeYearSummary[];
  const acs = acsCoverage as AcsCoverageSummary | undefined;
  const opportunity = opportunityAtlasCoverage as OpportunityAtlasCoverageSummary | undefined;
  const historicalStates = historicalStateCoverage as HistoricalStatePopulationCoverage | undefined;
  const timeline = (timelineSnapshot ?? undefined) as
    | NationalPopulationTimelineSnapshot
    | undefined;
  const timelineRows = timeline?.rows ?? [];
  const stateChanges = (stateChanges2010to2020 ?? []) as readonly StatePopulationChange[];
  const chartSources = (timeline?.sources ?? []).map((source) => ({
    label: source.label,
    url: source.sourceUrl,
  }));
  const lastRow = timelineRows.at(-1);
  const primarySource = lastRow
    ? (() => {
        const match = timeline?.sources.find((source) => source.sourceId === lastRow.sourceId);
        return match
          ? { label: match.label, url: match.sourceUrl }
          : { label: lastRow.sourceId, url: lastRow.sourceUrl };
      })()
    : { label: 'U.S. Census Bureau', url: 'https://www.census.gov' };
  const changeStripItems = timeline
    ? timelineChangeStripItems(timeline.changes, primarySource, 3)
    : [];

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Modeling</p>
      <h1 className="ds-page__title">Data behind the archive</h1>
      <p className="ds-page__lede">
        The national numbers underneath BlackStory&rsquo;s map and records: population shift,
        economic, and civil-rights context, each carrying the exact source it came from. County
        choropleths and alternate map models live on Explore; this page is the national-scale
        summary and the paper trail.
      </p>

      <DataSections
        timelineRows={timelineRows}
        chartSources={chartSources}
        changeStripItems={changeStripItems}
        stateChanges={stateChanges}
        stateNameByFips={STATE_NAME_BY_FIPS}
        historicalStates={historicalStates}
        acs={acs}
        hateCrime={hateCrime}
        hateCrimeByYear={hateCrimeByYear}
        latestHateCrimeYear={LATEST_HATE_CRIME_YEAR}
        opportunity={opportunity}
      />
    </main>
  );
}
