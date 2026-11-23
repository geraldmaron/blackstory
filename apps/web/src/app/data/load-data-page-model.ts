/**
 * What `/data` needs beyond its figures: which registry figures have rows in this release, the
 * two as-of dates, and the latest census row for the line under the title. The figures load their
 * own rows; the reads are shared, so asking here costs nothing twice.
 */
import type { NationalPopulationTimelineRow } from '@repo/domain/statistics/public-data-summaries';
import { getNationalPopulationTimelineSnapshot } from '../../lib/demographics/public-stats-source';
import { getDataPageIndicatorBundle } from '../../lib/demographics/data-page-indicators';
import { FIGURES, FIGURE_IDS, type FigureId } from '../../components/data/figures/registry';

async function safe<T>(promise: Promise<T | undefined | null>): Promise<T | undefined> {
  try {
    const value = await promise;
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

function formatAsOf(value: string | undefined): string {
  if (!value) return 'release date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export type DataPageModel = {
  /** The figures with something to draw, in registry order. */
  readonly figures: readonly FigureId[];
  readonly latestCensus: NationalPopulationTimelineRow | undefined;
  readonly populationAsOf: string;
  readonly indicatorsAsOf: string;
};

export async function loadDataPageModel(): Promise<DataPageModel> {
  const [timeline, indicators, loaded] = await Promise.all([
    safe(getNationalPopulationTimelineSnapshot()),
    safe(getDataPageIndicatorBundle()),
    Promise.all(FIGURE_IDS.map((id) => FIGURES[id].load())),
  ]);

  if (!indicators) {
    throw new Error('Data page indicator bundle unavailable');
  }

  return {
    figures: FIGURE_IDS.filter((_, index) => loaded[index] !== undefined),
    latestCensus: timeline?.rows.at(-1),
    populationAsOf: formatAsOf(timeline?.generatedAt),
    indicatorsAsOf: formatAsOf(indicators.generatedAt),
  };
}
