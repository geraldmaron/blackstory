/**
 * Live BJS NPS ingest for Phase 1 state imprisonment-rate observations into
 * bb_reference.statistical_observations. Derives race-specific rates from
 * Appendix table 1 prisoner counts (p23stat01.csv inside p23st.zip) and Census PEP.
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-bjs-nps.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE1_BJS_NPS_APPLY=1 DATABASE_URL=postgresql://... \
 *     CENSUS_API_KEY=... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-bjs-nps.ts
 *
 *   # Offline stat01 CSV (skip zip download)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-bjs-nps.ts \
 *     --bjs-stat-csv=packages/firebase/fixtures/reference-indicators/bjs-nps-p23stat01-snippet.csv
 */
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  BJS_NPS_MANUAL_RATES_DOC,
  BJS_NPS_P23_TABLES_ZIP_URL,
  BJS_NPS_STAT01_FILENAME,
  fetchPhase1BjsNpsObservations,
  listPhase1BjsNpsIndicators,
  type Phase1BjsNpsObservationDraft,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  buildPhase1IndicatorCoverageSnapshot,
  writePhase1IndicatorCoverageSnapshot,
} from './build-phase1-indicator-coverage-snapshot.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ENV_LOCAL = join(__dirname, '../../../apps/web/.env.local');

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function loadCensusApiKey(): string | undefined {
  if (process.env.CENSUS_API_KEY?.trim()) {
    return process.env.CENSUS_API_KEY.trim();
  }
  if (!existsSync(WEB_ENV_LOCAL)) return undefined;
  const match = readFileSync(WEB_ENV_LOCAL, 'utf8').match(/^CENSUS_API_KEY=(.+)$/m);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

async function downloadBjsStat01Csv(zipUrl: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'bjs-nps-'));
  const zipPath = join(tempDir, 'bjs-nps.zip');
  try {
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`BJS tables zip fetch failed (${response.status}) from ${zipUrl}`);
    }
    if (!response.body) {
      throw new Error('BJS tables zip response missing body');
    }
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(zipPath));
    return execFileSync('unzip', ['-p', zipPath, BJS_NPS_STAT01_FILENAME], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
  observations: readonly Phase1BjsNpsObservationDraft[],
  jurisdictionIds: Set<string>,
): {
  readonly accepted: readonly Phase1BjsNpsObservationDraft[];
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
  observations: readonly Phase1BjsNpsObservationDraft[],
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

    for (const series of listPhase1BjsNpsIndicators()) {
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
            raceEthnicitySlice: series.raceEthnicitySlice ?? null,
            methodologyNote: BJS_NPS_MANUAL_RATES_DOC,
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
          obs.raceEthnicitySlice,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify({
            prisonerCount: obs.prisonerCount,
            populationDenominator: obs.populationDenominator,
            methodologyNote: BJS_NPS_MANUAL_RATES_DOC,
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
  const apply = process.env.INGEST_PHASE1_BJS_NPS_APPLY === '1' && process.env.DRY_RUN !== '1';
  const statCsvPath = arg('bjs-stat-csv');
  const zipUrl = process.env.BJS_NPS_ZIP_URL?.trim() || BJS_NPS_P23_TABLES_ZIP_URL;
  const censusApiKey = loadCensusApiKey();

  const stat01CsvText = statCsvPath
    ? readFileSync(statCsvPath, 'utf8')
    : await downloadBjsStat01Csv(zipUrl);

  if (!censusApiKey) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          dryRun: !apply,
          blocker: 'missing_census_api_key',
          message:
            'Set CENSUS_API_KEY in env or apps/web/.env.local to derive race-specific imprisonment rates.',
          bjsZipUrl: zipUrl,
          manualRatesDoc: BJS_NPS_MANUAL_RATES_DOC,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const fetchResult = await fetchPhase1BjsNpsObservations({
    stat01CsvText,
    censusApiKey,
  });

  const byMetric = new Map<string, number>();
  for (const obs of fetchResult.observations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    referenceYear: fetchResult.referenceYear,
    statesParsed: fetchResult.statesParsed,
    fetchedObservations: fetchResult.observations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    rejectedParseRows: fetchResult.rejected.length,
    bjsZipUrl: zipUrl,
    sourceUrl: fetchResult.sourceUrl,
    methodologyNote: BJS_NPS_MANUAL_RATES_DOC,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE1_BJS_NPS_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
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
