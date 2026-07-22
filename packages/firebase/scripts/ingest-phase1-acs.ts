/**
 * Live ACS ingest for Phase 1 context indicators into bb_reference.statistical_*.
 *
 * Bounded default: county metrics for MD (24) + GA (13); state unemployment for all states.
 * Requires jurisdictions already loaded (see docs/runbooks/load-reference-jurisdictions.md).
 *
 * Usage (repo root):
 *   # Dry-run (default) — counts observations without writing
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-acs.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE1_ACS_APPLY=1 DATABASE_URL=postgresql://... \
 *     CENSUS_API_KEY=... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-acs.ts
 *
 *   # Custom county states (comma-separated 2-digit FIPS)
 *   PHASE1_ACS_COUNTY_STATES=13,24,17 node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-acs.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PHASE1_INDICATOR_CATALOG,
  PHASE1_ACS5_2024_VINTAGE,
  PHASE1_ACS_DEFAULT_COUNTY_STATE_FIPS,
  fetchPhase1AcsCountyObservations,
  fetchPhase1AcsStateObservations,
  listPhase1AcsIndicators,
  type Phase1AcsObservationDraft,
} from '@repo/domain';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ENV_LOCAL = join(__dirname, '../../../apps/web/.env.local');

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

function loadCensusApiKey(): string | undefined {
  if (process.env.CENSUS_API_KEY?.trim()) {
    return process.env.CENSUS_API_KEY.trim();
  }
  if (!existsSync(WEB_ENV_LOCAL)) return undefined;
  const match = readFileSync(WEB_ENV_LOCAL, 'utf8').match(/^CENSUS_API_KEY=(.+)$/m);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function parseCountyStateFips(): readonly string[] {
  const raw = process.env.PHASE1_ACS_COUNTY_STATES?.trim();
  if (!raw) return [...PHASE1_ACS_DEFAULT_COUNTY_STATE_FIPS];
  const states = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const stateFips of states) {
    if (!/^\d{2}$/.test(stateFips)) {
      throw new Error(`PHASE1_ACS_COUNTY_STATES entry must be 2-digit FIPS, got "${stateFips}"`);
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
  observations: readonly Phase1AcsObservationDraft[],
  jurisdictionIds: Set<string>,
): {
  readonly accepted: readonly Phase1AcsObservationDraft[];
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
  observations: readonly Phase1AcsObservationDraft[],
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

    for (const series of listPhase1AcsIndicators()) {
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
           margin_of_error = EXCLUDED.margin_of_error,
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
          obs.marginOfError ?? null,
          obs.raceEthnicitySlice ?? null,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify({
            numerator: obs.numerator ?? null,
            denominator: obs.denominator ?? null,
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
  const apply = process.env.INGEST_PHASE1_ACS_APPLY === '1' && process.env.DRY_RUN !== '1';
  const countyStates = parseCountyStateFips();
  const apiKey = loadCensusApiKey();

  if (!apiKey) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          dryRun: !apply,
          blocker: 'missing_census_api_key',
          message:
            'Set CENSUS_API_KEY in env or apps/web/.env.local, or run via run-with-dev-secrets.',
          countyStates,
          acsMetricsInCatalog: listPhase1AcsIndicators().length,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const fetchOptions = { apiKey };
  const [countyResult, stateResult] = await Promise.all([
    fetchPhase1AcsCountyObservations(PHASE1_ACS5_2024_VINTAGE, countyStates, fetchOptions),
    fetchPhase1AcsStateObservations(PHASE1_ACS5_2024_VINTAGE, fetchOptions),
  ]);

  const allObservations = [...countyResult.observations, ...stateResult.observations];
  const byMetric = new Map<string, number>();
  for (const obs of allObservations) {
    byMetric.set(obs.metricId, (byMetric.get(obs.metricId) ?? 0) + 1);
  }

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    vintage: PHASE1_ACS5_2024_VINTAGE.vintage,
    bound: {
      countyStates,
      countyRowsParsed: countyResult.rowsParsed,
      stateRowsParsed: stateResult.rowsParsed,
      note: 'County pull bounded to PHASE1_ACS_COUNTY_STATES (default MD+GA). State unemployment is all states.',
    },
    fetchedObservations: allObservations.length,
    observationsByMetric: Object.fromEntries([...byMetric.entries()].sort()),
    rejected: {
      county: countyResult.rejected.length,
      state: stateResult.rejected.length,
    },
    catalogAcsMetrics: listPhase1AcsIndicators().map((row) => row.metricId),
    totalCatalogMetrics: PHASE1_INDICATOR_CATALOG.length,
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE1_ACS_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const jurisdictionIds = await loadExistingJurisdictionIds(databaseUrl);
  const { accepted, missingJurisdictions } = filterObservationsWithJurisdictions(
    allObservations,
    jurisdictionIds,
  );

  if (missingJurisdictions.length > 0) {
    summary.missingJurisdictionCount = missingJurisdictions.length;
    summary.missingJurisdictionSample = missingJurisdictions.slice(0, 10);
  }

  const written = await applyObservations(accepted, databaseUrl);
  summary.appliedObservations = written;
  summary.skippedMissingJurisdiction = allObservations.length - accepted.length;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
