/**
 * `/data`: the reference ledger. National census counts plus published indicator series
 * (wealth, housing, credit, justice). Every figure names the series behind it.
 *
 * This file reads the data and writes the four headline numbers. Everything on screen below the
 * room header is `DataSections`.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { US_STATES } from '@repo/domain/map/geography';
import { buildStateFipsNameMap } from '@repo/domain/statistics/public-data-summaries';
import {
  getNationalPopulationTimelineSnapshot,
  getStatePopulationChanges,
  type NationalPopulationTimelineSnapshot,
  type StatePopulationChange,
} from '../../lib/demographics/public-stats-source';
import { getDataPageIndicatorBundle } from '../../lib/demographics/data-page-indicators';
import { timelineChangeStripItems } from '../../components/data/population-change';
import { formatSharePct } from '../../components/data/chart-utils';
import '../../components/data/data-charts.css';
import './data-page.css';
import { DATA_INTRO, DATA_PAGE_DESCRIPTION } from './data-copy';
import { DataSections, type DataHeadline } from './DataSections';
import { Room, RoomHeader } from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
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

function formatAsOf(value: string | undefined): string {
  if (!value) return 'release date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default async function DataPage() {
  const [timelineSnapshot, stateChanges2010to2020, indicators] = await Promise.all([
    safe(getNationalPopulationTimelineSnapshot()),
    safe(getStatePopulationChanges('2010', '2020')),
    safe(getDataPageIndicatorBundle()),
  ]);

  if (!indicators) {
    throw new Error('Data page indicator bundle unavailable');
  }

  const timeline = timelineSnapshot as NationalPopulationTimelineSnapshot | undefined;
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
  const deltaItems = timeline
    ? timelineChangeStripItems(timeline.changes, primarySource, 3).map((item) => ({
        id: item.id,
        value: item.value,
        label: item.label,
        note: item.note,
      }))
    : [];

  const indicatorsAsOf = formatAsOf(indicators.generatedAt);
  const populationAsOf = formatAsOf(timeline?.generatedAt);

  /*
   * The headline band: four numbers a reader can take away, each linking to the figure that
   * carries it. Written here, not in the sections, because they are the page's own summary of
   * the data it was handed, and a section should not have to know what its neighbours show.
   */
  const homeLast = indicators.cookHomeownership.points.at(-1);
  const homeGap =
    homeLast !== undefined
      ? Math.round(((homeLast.values.white ?? 0) - (homeLast.values.black ?? 0)) * 10) / 10
      : undefined;
  const headlines: DataHeadline[] = [
    ...(lastRow
      ? [
          {
            id: 'population',
            value: formatSharePct(lastRow.blackPopulation, lastRow.totalPopulation).replace(
              '%',
              '',
            ),
            unit: '%',
            label: `of the country counted Black in the ${lastRow.decade} census, ${(lastRow.blackPopulation / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 1 })} million people.`,
            source: 'U.S. Census Bureau',
            href: '#population-count',
          },
        ]
      : []),
    ...(indicators.wealthComparison.ratioValue !== undefined
      ? [
          {
            id: 'wealth',
            value: indicators.wealthComparison.ratioValue.toLocaleString('en-US'),
            unit: '×',
            label: `median wealth of a White family to a Black family, ${indicators.wealthComparison.referencePeriod}.`,
            source: 'Federal Reserve, Survey of Consumer Finances',
            href: '#wealth-gap',
          },
        ]
      : []),
    ...(homeGap !== undefined && homeLast !== undefined
      ? [
          {
            id: 'housing',
            value: homeGap.toLocaleString('en-US'),
            unit: 'pts',
            label: `homeownership gap between White and Black householders in Cook County, ${homeLast.period}.`,
            source: 'NHGIS, decennial census',
            href: '#housing-ownership',
          },
        ]
      : []),
    ...(indicators.imprisonmentComparison.ratioValue !== undefined
      ? [
          {
            id: 'justice',
            value: indicators.imprisonmentComparison.ratioValue.toLocaleString('en-US'),
            unit: '×',
            label: `state imprisonment rate of Black residents to White residents in ${indicators.imprisonmentComparison.geographyLabel}, ${indicators.imprisonmentComparison.referencePeriod}.`,
            source: 'Bureau of Justice Statistics',
            href: '#justice-imprisonment',
          },
        ]
      : []),
  ];

  return (
    <Room>
      <RoomHeader
        pathname="/data"
        kicker={DATA_INTRO.kicker}
        title="Data"
        lede={DATA_INTRO.lede}
        meta={[`Indicators as of ${indicatorsAsOf}`, '11 figures', '7 agencies']}
      />

      <DataSections
        headlines={headlines}
        timelineRows={timelineRows}
        chartSources={chartSources}
        deltaItems={deltaItems}
        stateChanges={stateChanges}
        stateNameByFips={STATE_NAME_BY_FIPS}
        indicators={indicators}
        populationAsOf={populationAsOf}
        indicatorsAsOf={indicatorsAsOf}
      />

      <WalkOffRamp>
        Every series here is published by the agency named beneath its figure.
      </WalkOffRamp>
    </Room>
  );
}
