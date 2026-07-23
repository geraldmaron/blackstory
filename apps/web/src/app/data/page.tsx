/**
 * Data page: national Census population plus Phase 1 / theme-impact indicator visualizations
 * (wealth, housing, justice). Charts wire to warehouse observations or verified fixtures.
 */
import { US_STATES } from '@repo/domain/map/geography';
import { buildStateFipsNameMap } from '@repo/domain/statistics/public-data-summaries';
import {
  getHistoricalStatePopulationCoverage,
  getNationalPopulationTimelineSnapshot,
  getPhase1IndicatorCoverageSummary,
  getStatePopulationChanges,
  type HistoricalStatePopulationCoverage,
  type NationalPopulationTimelineSnapshot,
  type Phase1IndicatorCoverageSummary,
  type StatePopulationChange,
} from '../../lib/demographics/public-stats-source';
import { getDataPageIndicatorBundle } from '../../lib/demographics/data-page-indicators';
import { timelineChangeStripItems } from '../../components/data/population-change';
import '../../components/data/data-charts.css';
import { DataSections } from './DataSections';

export const metadata = {
  title: 'Data',
  description:
    'National Census population and Phase 1 indicator charts — wealth, housing, credit, and justice figures behind the BlackStory archive, each with sources you can open.',
};

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
    phase1Indicators,
    indicators,
  ] = await Promise.all([
    safe(getNationalPopulationTimelineSnapshot()),
    safe(getStatePopulationChanges('2010', '2020')),
    safe(getHistoricalStatePopulationCoverage()),
    safe(getPhase1IndicatorCoverageSummary()),
    safe(getDataPageIndicatorBundle()),
  ]);

  const phase1 = phase1Indicators as Phase1IndicatorCoverageSummary | undefined;
  const historicalStates = historicalStateCoverage as HistoricalStatePopulationCoverage | undefined;
  const timeline = (timelineSnapshot ?? undefined) as NationalPopulationTimelineSnapshot | undefined;
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

  if (!indicators) {
    throw new Error('Data page indicator bundle unavailable');
  }

  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Numbers</p>
      <h1 className="ds-page__title">Data behind the archive</h1>
      <p className="ds-page__lede">
        National Census context plus curated indicators we use on Themes — wealth, housing, credit,
        and justice. Every chart names its source. For county maps, open Explore.
      </p>

      <DataSections
        timelineRows={timelineRows}
        chartSources={chartSources}
        changeStripItems={changeStripItems}
        stateChanges={stateChanges}
        stateNameByFips={STATE_NAME_BY_FIPS}
        historicalStates={historicalStates}
        phase1Indicators={phase1}
        indicators={indicators}
      />
    </main>
  );
}
