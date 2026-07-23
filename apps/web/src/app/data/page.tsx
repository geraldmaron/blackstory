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
import { EditionAtmosphereMosaic } from '../../components/patterns/edition-atmosphere/EditionAtmosphereMosaic';
import {
  EDITION_MOSAIC_COUNT_BROWSE,
} from '../../components/patterns/edition-atmosphere/edition-atmosphere-config';
import '../../components/data/data-charts.css';
import { DATA_PAGE_DESCRIPTION } from './data-copy';
import {
  DATA_EDITION_MOSAIC_SEED,
  dataEditionRootClassName,
} from './data-panel-chrome';
import { DataSections } from './DataSections';
import './data-edition.css';

export const metadata = {
  title: 'Data',
  description: DATA_PAGE_DESCRIPTION,
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
    <div className={dataEditionRootClassName()} data-data-edition="v6">
      <EditionAtmosphereMosaic seedKey={DATA_EDITION_MOSAIC_SEED} count={EDITION_MOSAIC_COUNT_BROWSE} />
      <main className="ds-container ds-page" id="main">
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
    </div>
  );
}
