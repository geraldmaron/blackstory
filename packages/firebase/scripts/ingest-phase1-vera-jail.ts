/**
 * Live Vera Incarceration Trends ingest for Phase 1 county jail population rate
 * observations into bb_reference.statistical_observations.
 *
 * Usage (repo root):
 *   # Dry-run (default) — bounded to GA+MD unless PHASE1_VERA_ALL_COUNTIES=1
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-vera-jail.ts
 *
 *   # Apply all counties (latest year per county)
 *   DRY_RUN=0 INGEST_PHASE1_VERA_JAIL_APPLY=1 PHASE1_VERA_ALL_COUNTIES=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-vera-jail.ts
 *
 *   # Fixture/offline CSV
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-vera-jail.ts \
 *     --vera-csv=packages/firebase/fixtures/reference-indicators/vera-county-snippet.csv
 */
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchPhase1VeraJailCountyObservations,
  listPhase1VeraJailIndicators,
  PHASE1_VERA_DEFAULT_COUNTY_STATE_FIPS,
  VERA_INCARCERATION_ATTRIBUTION_NOTE,
  VERA_INCARCERATION_TRENDS_COUNTY_CSV_URL,
  type Phase1VeraJailObservationDraft,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildPhase1IndicatorCoverageSnapshot,
  writePhase1IndicatorCoverageSnapshot,
} from './build-phase1-indicator-coverage-snapshot.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function parseCountyStateFips(): readonly string[] | undefined {
  if (process.env.PHASE1_VERA_ALL_COUNTIES === '1') return undefined;
  const raw = process.env.PHASE1_VERA_COUNTY_STATES?.trim();
  if (!raw) return [...PHASE1_VERA_DEFAULT_COUNTY_STATE_FIPS];
  const states = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const stateFips of states) {
    if (!/^\d{2}$/.test(stateFips)) {
      throw new Error(`PHASE1_VERA_COUNTY_STATES entry must be 2-digit FIPS, got "${stateFips}"`);
    }
  }
  return states;
}

function parseReferenceYear(): number | undefined {
  const raw = process.env.PHASE1_VERA_REFERENCE_YEAR?.trim();
  if (!raw) return undefined;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    throw new Error(`PHASE1_VERA_REFERENCE_YEAR must be a plausible year, got "${raw}"`);
  }
  return year;
}

async function loadExistingJurisdictionIds(databaseUrl: string): Promise<Set<string>> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  try {
    const result = await pool.query<{ id: string }>('SELECT id FROM bb_reference.jurisdictions');
    return new Set(result.rows.map((row) => row.id));
  } finally {
    await pool.end();
  }
}

function filterObservationsWithJurisdictions(
  observations: readonly Phase1VeraJailObservationDraft[],
  jurisdictionIds: Set<string>,
): {
  readonly accepted: readonly Phase1VeraJailObservationDraft[];
  readonly missingJurisdictions: readonly string[];
} {
  const missing = new Set<string>();
  const accepted = observations.filter((obs) => {
    if (jurisdictionIds.has(obs.jurisdictionId)) return true;
    missing.add(obs.jurisdictionId);
    return false;
  });
  return { accepted, missingJurisdictions: [...missing].sort() };
}

async function applyObservations(
  observations: readonly Phase1VeraJailObservationDraft[],
  databaseUrl: string,
): Promise<number> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  let written = 0;
  try {
    await client.query('BEGIN');

    for (const series of listPhase1VeraJailIndicators()) {
      await client.query(
        `INSERT INTO bb_reference.statistical_series
          (metric_id, metric_definition, universe, unit, source_dataset, source_table,
           source_variable, geography_type, estimate_type, period_type,
           external_data_source_id, theme, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ON CONFLICT (metric_id) DO UPDATE SET
           metric_definition = EXCLUDED.metric_definition,
           universe = EXCLUDED.universe,
           unit = EXCLUDED.unit,
           source_dataset = EXCLUDED.source_dataset,
           source_table = EXCLUDED.source_table,
           source_variable = EXCLUDED.source_variable,
           geography_type = EXCLUDED.geography_type,
           estimate_type = EXCLUDED.estimate_type,
           period_type = EXCLUDED.period_type,
           external_data_source_id = EXCLUDED.external_data_source_id,
           theme = EXCLUDED.theme,
           updated_at = now()`,
        [
          series.metricId,
          series.metricDefinition,
          series.universe,
          series.unit,
          series.sourceDataset,
          series.sourceTable,
          series.sourceVariable,
          series.geographyType,
          series.estimateType,
          series.periodType,
          series.externalDataSourceId,
          series.theme,
          JSON.stringify({
            attributionNote: VERA_INCARCERATION_ATTRIBUTION_NOTE,
          }),
        ],
      );
    }

    for (const obs of observations) {
      await client.query(
        `INSERT INTO bb_reference.statistical_observations
          (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage,
           estimate, margin_of_error, race_ethnicity_slice, status, source, source_url,
           retrieved_at, content_hash, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'observed',$10,$11,$12::timestamptz,$13,$14::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           estimate = EXCLUDED.estimate,
           content_hash = EXCLUDED.content_hash,
           retrieved_at = EXCLUDED.retrieved_at,
           metadata = EXCLUDED.metadata`,
        [
          obs.id,
          obs.metricId,
          obs.jurisdictionId,
          obs.boundaryVersion,
          obs.referencePeriod,
          obs.datasetVintage,
          obs.estimate,
          null,
          null,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify({
            attributionNote: obs.attributionNote,
            dataUrl: VERA_INCARCERATION_TRENDS_COUNTY_CSV_URL,
          }),
        ],
      );
      written += 1;
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  return written;
}

async function main(): Promise<void> {
  const apply = process.env.INGEST_PHASE1_VERA_JAIL_APPLY === '1' && process.env.DRY_RUN !== '1';
  const countyStates = parseCountyStateFips();
  const referenceYear = parseReferenceYear();
  const latestPerCounty = process.env.PHASE1_VERA_ALL_COUNTIES === '1' && referenceYear === undefined;
  const csvPath = arg('vera-csv');

  const fetchResult = await fetchPhase1VeraJailCountyObservations({
    ...(csvPath ? { csvText: readFileSync(csvPath, 'utf8') } : {}),
    ...(countyStates ? { stateFipsList: countyStates } : {}),
    ...(referenceYear !== undefined ? { referenceYear } : {}),
    ...(latestPerCounty ? { latestPerCounty: true } : {}),
  });

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    metricId: 'vera-jail-population-rate-county',
    attribution: VERA_INCARCERATION_ATTRIBUTION_NOTE,
    sourceUrl: fetchResult.sourceUrl,
    bound: {
      countyStates: countyStates ?? 'all',
      referenceYear: referenceYear ?? (latestPerCounty ? 'latest-per-county' : 'all-years-in-filter'),
      rowsParsed: fetchResult.rowsParsed,
      rowsSelected: fetchResult.rowsSelected,
    },
    fetchedObservations: fetchResult.observations.length,
    rejectedParseRows: fetchResult.rejected.length,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE1_VERA_JAIL_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const jurisdictionIds = await loadExistingJurisdictionIds(databaseUrl);
  const { accepted, missingJurisdictions } = filterObservationsWithJurisdictions(
    fetchResult.observations,
    jurisdictionIds,
  );
  if (missingJurisdictions.length > 0) {
    summary.missingJurisdictionCount = missingJurisdictions.length;
    summary.missingJurisdictionSample = missingJurisdictions.slice(0, 10);
  }

  const written = await applyObservations(accepted, databaseUrl);
  summary.appliedObservations = written;
  summary.skippedMissingJurisdiction = fetchResult.observations.length - accepted.length;

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool(conn);
  try {
    const snapshot = await buildPhase1IndicatorCoverageSnapshot(pool);
    const snapshotOutcome = await writePhase1IndicatorCoverageSnapshot(pool, snapshot);
    summary.snapshotOutcome = snapshotOutcome;
    summary.sampleObservationCount = snapshot.sampleObservationCount;
    summary.seriesCount = snapshot.seriesCount;
  } finally {
    await pool.end();
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
