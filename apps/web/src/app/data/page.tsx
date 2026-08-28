/**
 * Data page: national Census population plus published indicator charts
 * (wealth, housing, justice). Every chart names its source.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
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
import './data-page.css';
import { DATA_INTRO, DATA_PAGE_DESCRIPTION } from './data-copy';
import { DataSections } from './DataSections';
import { OffRamp, Room, RoomHeader } from '../../components/room';
import '../reading-room.css';

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/data',
  title: 'Data',
  description: DATA_PAGE_DESCRIPTION,
});

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
  const timeline = (timelineSnapshot ?? undefined) as
    NationalPopulationTimelineSnapshot | undefined;
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

  const asOfDate = new Date(indicators.generatedAt);
  const asOfLabel = Number.isNaN(asOfDate.getTime())
    ? indicators.generatedAt
    : asOfDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Room>
      <RoomHeader
        pathname="/data"
        kicker="Indicators"
        title="Data"
        lede={DATA_INTRO.lede}
        meta={[`As of ${asOfLabel} release`]}
      />

      <DataSections
        timelineRows={timelineRows}
        chartSources={chartSources}
        changeStripItems={changeStripItems}
        stateChanges={stateChanges}
        stateNameByFips={STATE_NAME_BY_FIPS}
        historicalStates={historicalStates}
        phase1Indicators={phase1}
        indicators={indicators}
        populationGeneratedAt={timeline?.generatedAt}
      />

      <OffRamp
        title="Back to the place"
        actions={[
          { label: 'The place', href: '/', emphasis: 'copper' },
          { label: 'Search the record index', href: '/records' },
        ]}
      >
        Every number here is a national series. For the records behind a place, use the record
        index.
      </OffRamp>
    </Room>
  );
}
