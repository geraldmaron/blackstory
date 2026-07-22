/**
 * Validate and optionally upsert Phase 1 indicator catalog + sample observations
 * into bb_reference.statistical_* (and seed jurisdictions / entity_context_bindings).
 *
 * Usage (repo root):
 *   # Validate fixture only (default)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-indicators.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE1_INDICATORS_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-phase1-indicators.ts
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PHASE1_INDICATOR_CATALOG,
  assertPublishedStatisticProvenance,
  getPhase1Indicator,
  summarizePhase1IndicatorCatalog,
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FIXTURE = join(
  __dirname,
  '../fixtures/reference-indicators/phase1-sample-observations.json',
);

type JurisdictionRow = {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly stateFips: string | null;
  readonly countyFips: string | null;
  readonly parentId: string | null;
};

type ObservationRow = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly marginOfError?: number;
  readonly raceEthnicitySlice?: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly notes?: string;
};

type BindingRow = {
  readonly id: string;
  readonly entityId: string;
  readonly metricId: string;
  readonly purpose: string;
  readonly jurisdictionId?: string | null;
  readonly notes: string;
};

type Phase1Fixture = {
  readonly jurisdictions: readonly JurisdictionRow[];
  readonly observations: readonly ObservationRow[];
  readonly bindings?: readonly BindingRow[];
};

function contentHash(parts: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

function loadFixture(path: string): Phase1Fixture {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Phase1Fixture;
  if (!Array.isArray(raw.jurisdictions) || !Array.isArray(raw.observations)) {
    throw new Error('Fixture must include jurisdictions[] and observations[]');
  }
  return raw;
}

function validateFixture(fixture: Phase1Fixture): void {
  const jurisdictionIds = new Set(fixture.jurisdictions.map((j) => j.id));
  for (const obs of fixture.observations) {
    if (!getPhase1Indicator(obs.metricId)) {
      throw new Error(`Unknown metricId (not in Phase 1 catalog): ${obs.metricId}`);
    }
    if (!jurisdictionIds.has(obs.jurisdictionId)) {
      throw new Error(`Observation ${obs.id} references missing jurisdiction ${obs.jurisdictionId}`);
    }
    const hash = contentHash({
      metricId: obs.metricId,
      jurisdictionId: obs.jurisdictionId,
      referencePeriod: obs.referencePeriod,
      estimate: obs.estimate,
      boundaryVersion: obs.boundaryVersion,
    });
    assertPublishedStatisticProvenance({
      source: obs.source,
      sourceUrl: obs.sourceUrl,
      retrievedAt: obs.retrievedAt,
      contentHash: hash,
    });
  }
  for (const binding of fixture.bindings ?? []) {
    if (!getPhase1Indicator(binding.metricId)) {
      throw new Error(`Binding ${binding.id} unknown metric ${binding.metricId}`);
    }
  }
}

async function applyToPostgres(fixture: Phase1Fixture, databaseUrl: string): Promise<void> {
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const j of fixture.jurisdictions) {
      await client.query(
        `INSERT INTO bb_reference.jurisdictions
          (id, kind, name, state_fips, county_fips, parent_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           kind = EXCLUDED.kind,
           name = EXCLUDED.name,
           state_fips = EXCLUDED.state_fips,
           county_fips = EXCLUDED.county_fips,
           parent_id = EXCLUDED.parent_id,
           updated_at = now()`,
        [
          j.id,
          j.kind,
          j.name,
          j.stateFips,
          j.countyFips,
          j.parentId,
          JSON.stringify({ seededBy: 'ingest-phase1-indicators' }),
        ],
      );
    }

    for (const series of PHASE1_INDICATOR_CATALOG) {
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

    for (const obs of fixture.observations) {
      const hash = contentHash({
        metricId: obs.metricId,
        jurisdictionId: obs.jurisdictionId,
        referencePeriod: obs.referencePeriod,
        estimate: obs.estimate,
        boundaryVersion: obs.boundaryVersion,
      });
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
          hash,
          JSON.stringify({ notes: obs.notes ?? null }),
        ],
      );
    }

    for (const binding of fixture.bindings ?? []) {
      await client.query(
        `INSERT INTO bb_reference.entity_context_bindings
          (id, entity_id, metric_id, purpose, jurisdiction_id, notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           notes = EXCLUDED.notes,
           updated_at = now()`,
        [
          binding.id,
          binding.entityId,
          binding.metricId,
          binding.purpose,
          binding.jurisdictionId ?? null,
          binding.notes,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main(): Promise<void> {
  const fixturePath =
    process.argv.find((a) => a.startsWith('--fixture='))?.slice('--fixture='.length) ??
    DEFAULT_FIXTURE;
  const apply =
    process.env.INGEST_PHASE1_INDICATORS_APPLY === '1' && process.env.DRY_RUN !== '1';
  const fixture = loadFixture(fixturePath);
  validateFixture(fixture);

  const catalog = summarizePhase1IndicatorCatalog();
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: !apply,
        catalogMetricCount: catalog.metricCount,
        fixtureJurisdictions: fixture.jurisdictions.length,
        fixtureObservations: fixture.observations.length,
        fixtureBindings: fixture.bindings?.length ?? 0,
        themes: catalog.themes,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log('Dry-run only. Set INGEST_PHASE1_INDICATORS_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }
  await applyToPostgres(fixture, databaseUrl);
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool(conn);
  try {
    const snapshot = await buildPhase1IndicatorCoverageSnapshot(pool);
    const snapshotOutcome = await writePhase1IndicatorCoverageSnapshot(pool, snapshot);
    console.log(
      JSON.stringify(
        {
          applied: true,
          snapshotOutcome,
          sampleObservationCount: snapshot.sampleObservationCount,
          seriesCount: snapshot.seriesCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
