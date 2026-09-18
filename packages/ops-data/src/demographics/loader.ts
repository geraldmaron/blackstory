/** Deterministic source parsing and ingestion through an injected record writer. */
import {
  assertPublishedStatisticProvenance,
  buildProvenanceSourceUrl,
  fetchCountyPopulations,
  sha256Json,
  CENSUS_DECENNIAL_VINTAGES,
  type CensusDecennialVintage,
  type CountyDecadePopulation,
  type FetchLike,
} from '@repo/domain';
import {
  censusCountyDecadeId,
  censusCountyDecadeSchema,
  type CensusCountyDecadeDoc,
} from './schema.js';

export type CensusCountyDecadeWriteOutcome = 'created' | 'updated' | 'unchanged';

export type CensusCountyDecadeWriter = {
  /** Upserts one doc idempotently (skip when `contentHash` matches) and reports the outcome. */
  upsert(doc: CensusCountyDecadeDoc): Promise<CensusCountyDecadeWriteOutcome>;
};

export type RunDemographicsLoadOptions = {
  readonly writer: CensusCountyDecadeWriter;
  readonly apiKey?: string;
  readonly fetchImpl?: FetchLike;
  readonly vintages?: readonly CensusDecennialVintage[];
  readonly now?: () => string;
};

export type RunDemographicsVintageSummary = {
  readonly decade: CensusDecennialVintage['decade'];
  readonly fetched: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: readonly string[];
};

export type RunDemographicsLoadSummary = {
  readonly vintages: readonly RunDemographicsVintageSummary[];
  readonly totalWritten: number;
};

/** The stable fields `contentHash` covers — everything except retrieval/write timestamps. */
export function censusCountyDecadeContentFields(
  row: CountyDecadePopulation,
  vintage: CensusDecennialVintage,
): Record<string, string | number> {
  return {
    fips5: row.fips5,
    decade: row.decade,
    countyName: row.countyName,
    totalPopulation: row.totalPopulation,
    blackPopulation: row.blackPopulation,
    source: vintage.sourceId,
    sourceUrl: buildProvenanceSourceUrl(vintage),
  };
}

export function buildCensusCountyDecadeDoc(
  row: CountyDecadePopulation,
  vintage: CensusDecennialVintage,
  nowIso: string,
): CensusCountyDecadeDoc {
  const doc: CensusCountyDecadeDoc = {
    id: censusCountyDecadeId(row.fips5, row.decade),
    fips5: row.fips5,
    stateFips: row.stateFips,
    countyFips: row.countyFips,
    countyName: row.countyName,
    decade: row.decade,
    totalPopulation: row.totalPopulation,
    blackPopulation: row.blackPopulation,
    source: vintage.sourceId,
    sourceUrl: buildProvenanceSourceUrl(vintage),
    retrievedAt: nowIso,
    contentHash: sha256Json(censusCountyDecadeContentFields(row, vintage)).digest,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  assertPublishedStatisticProvenance(doc);
  return censusCountyDecadeSchema.parse(doc);
}

export async function runDemographicsLoad(
  options: RunDemographicsLoadOptions,
): Promise<RunDemographicsLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const vintages = options.vintages ?? CENSUS_DECENNIAL_VINTAGES;

  const summaries: RunDemographicsVintageSummary[] = [];
  let totalWritten = 0;

  for (const vintage of vintages) {
    const fetched = await fetchCountyPopulations(vintage, {
      ...(options.apiKey ? { apiKey: options.apiKey } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const nowIso = now();

    for (const row of fetched.rows) {
      const doc = buildCensusCountyDecadeDoc(row, vintage, nowIso);
      const outcome = await options.writer.upsert(doc);
      if (outcome === 'created') created += 1;
      else if (outcome === 'updated') updated += 1;
      else unchanged += 1;
    }

    totalWritten += created + updated;
    summaries.push({
      decade: vintage.decade,
      fetched: fetched.rows.length,
      created,
      updated,
      unchanged,
      rejected: fetched.rejected,
    });
  }

  return { vintages: summaries, totalWritten };
}
