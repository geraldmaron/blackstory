/**
 * Shared loader for the Data ledger figures. Used by `/data` (canonical) and kept
 * colocated with the DataSections props so headline math stays in one place.
 */
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
import type { DataDeltaItem, DataHeadline, DataSectionsProps } from './DataSections';

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

/**
 * The Data section's own content. The Lives bundle is NOT part of it: /lives folded into the
 * how-it-works room, and the how-it-works page loads the reader's chosen area alongside this model and
 * passes it to `DataSections` itself. Typing `sections` as the full props would claim this loader
 * supplies an area bundle it never reads.
 */
export type DataPageModel = {
  readonly sections: Omit<DataSectionsProps, 'livesBundle' | 'livesAreaSlug'>;
  readonly colophonFacts: readonly string[];
};

export async function loadDataPageModel(): Promise<DataPageModel> {
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
  const deltaItems: readonly DataDeltaItem[] = timeline
    ? timelineChangeStripItems(timeline.changes, primarySource, 3).map((item) => ({
        id: item.id,
        value: item.value,
        label: item.label,
        ...(item.note === undefined ? {} : { note: item.note }),
      }))
    : [];

  const indicatorsAsOf = formatAsOf(indicators.generatedAt);
  const populationAsOf = formatAsOf(timeline?.generatedAt);

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

  return {
    sections: {
      headlines,
      timelineRows,
      chartSources,
      deltaItems,
      stateChanges,
      stateNameByFips: STATE_NAME_BY_FIPS,
      indicators,
      populationAsOf,
      indicatorsAsOf,
    },
    colophonFacts: [`Indicators as of ${indicatorsAsOf}`, '13 figures', '8 agencies'],
  };
}
