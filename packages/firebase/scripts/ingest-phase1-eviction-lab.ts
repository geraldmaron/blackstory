/**
 * Live Eviction Lab ingest for Phase 1 county filing-rate observations into
 * bb_reference.statistical_observations (court-observed rows only; partial coverage by design).
 *
 * Usage (repo root):
 *   # Dry-run (default) — fetch + count without writing
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-eviction-lab.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE1_EVICTION_LAB_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-eviction-lab.ts
 *
 *   # Custom county states (comma-separated 2-digit FIPS; default GA+MD)
 *   PHASE1_EVICTION_COUNTY_STATES=13,24 node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-eviction-lab.ts
 */
import {
  EVICTION_LAB_ATTRIBUTION_NOTE,
  EVICTION_LAB_DATA_FOR_ANALYSIS_URL,
  fetchPhase1EvictionCountyObservations,
  listPhase1EvictionIndicators,
  PHASE1_EVICTION_DEFAULT_COUNTY_STATE_FIPS,
  type Phase1EvictionObservationDraft,
} from '@repo/domain';
import pg from 'pg';
import {
  buildPhase1IndicatorCoverageSnapshot,
  writePhase1IndicatorCoverageSnapshot,
} from './build-phase1-indicator-coverage-snapshot.ts';

function normalizePgConnectionString(connectionString: string): {
  readonly connectionString: string;
  readonly ssl?: { readonly rejectUnauthorized: false };
} {
  const isSupabase =
    /supabase\.(co|com)/i.test(connectionString) ||
    process.env.DATABASE_SSL === '1' ||
    process.env.DATABASE_SSL === 'true';
  if (!isSupabase) return { connectionString };
  let normalized = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.set('uselibpqcompat', 'true');
    url.searchParams.set('sslmode', 'require');
    normalized = url.toString();
  } catch {
    normalized = connectionString;
  }
  return {
    connectionString: normalized,
    ssl: { rejectUnauthorized: false },
  };
}

function parseCountyStateFips(): readonly string[] {
  const raw = process.env.PHASE1_EVICTION_COUNTY_STATES?.trim();
  if (!raw) return [...PHASE1_EVICTION_DEFAULT_COUNTY_STATE_FIPS];
  const states = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const stateFips of states) {
    if (!/^\d{2}$/.test(stateFips)) {
      throw new Error(`PHASE1_EVICTION_COUNTY_STATES entry must be 2-digit FIPS, got "${stateFips}"`);
    }
  }
  return states;
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
  observations: readonly Phase1EvictionObservationDraft[],
  jurisdictionIds: Set<string>,
): {
  readonly accepted: readonly Phase1EvictionObservationDraft[];
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
  observations: readonly Phase1EvictionObservationDraft[],
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

    for (const series of listPhase1EvictionIndicators()) {
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
            attributionNote: EVICTION_LAB_ATTRIBUTION_NOTE,
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
            coverageType: obs.coverageType,
            filings: obs.filings ?? null,
            dataUrl: EVICTION_LAB_DATA_FOR_ANALYSIS_URL,
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
  const apply =
    process.env.INGEST_PHASE1_EVICTION_LAB_APPLY === '1' && process.env.DRY_RUN !== '1';
  const countyStates = parseCountyStateFips();
  const fetchResult = await fetchPhase1EvictionCountyObservations(countyStates);

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    metricId: 'eviction-filing-rate-county',
    attribution: EVICTION_LAB_ATTRIBUTION_NOTE,
    sourceUrl: fetchResult.sourceUrl,
    bound: {
      countyStates,
      rowsParsed: fetchResult.rowsParsed,
      rowsObserved: fetchResult.rowsObserved,
      note: 'Only court-observed rows ingested; partial coverage by design (no false absence).',
    },
    fetchedObservations: fetchResult.observations.length,
    rejectedParseRows: fetchResult.rejected.length,
    license: 'ODC-BY 1.0 (attribution required)',
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE1_EVICTION_LAB_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
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
