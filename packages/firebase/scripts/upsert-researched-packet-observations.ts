/**
 * Upserts every observation embedded in RESEARCHED_THEME_IMPACT_PACKETS into
 * bb_reference.statistical_series + statistical_observations (reference stage).
 * Required before apply-theme-impact-packets.ts can verify canonical inputs.
 *
 * Usage (repo root):
 *   # Dry-run
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/upsert-researched-packet-observations.ts
 *
 *   # Apply
 *   DRY_RUN=0 UPSERT_RESEARCHED_PACKET_OBSERVATIONS=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/upsert-researched-packet-observations.ts
 */
import {
  RESEARCHED_THEME_IMPACT_PACKETS,
  type ThemeImpactPacketObservation,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

type SeriesSeed = {
  readonly metricId: string;
  readonly metricDefinition: string;
  readonly universe: string;
  readonly unit: string;
  readonly sourceDataset: string;
  readonly sourceTable: string;
  readonly sourceVariable: string;
  readonly geographyType: string;
  readonly estimateType: string;
  readonly periodType: string;
  readonly externalDataSourceId: string;
  readonly theme: string;
};

function seriesSeedFor(metricId: string, unit: string, source: string): SeriesSeed {
  const geographyType = metricId.includes('-state')
    ? 'state'
    : metricId.includes('-county')
      ? 'county'
      : metricId.includes('-nation') || metricId.includes('-district')
        ? metricId.includes('-district')
          ? 'district'
          : 'nation'
        : 'nation';
  const theme = metricId.includes('turnout') || metricId.includes('voting')
    ? 'demography'
    : metricId.includes('imprison') || metricId.includes('jail') || metricId.includes('ussc')
      ? 'justice'
      : metricId.includes('hmda') || metricId.includes('homeownership') || metricId.includes('chas')
        ? 'housing'
        : metricId.includes('scf') || metricId.includes('income') || metricId.includes('poverty')
          ? 'wealth'
          : metricId.includes('eji') || metricId.includes('tri')
            ? 'environment'
            : metricId.includes('ba-plus') || metricId.includes('attainment')
              ? 'education'
              : 'demography';
  return {
    metricId,
    metricDefinition: `Curated theme-impact metric ${metricId}`,
    universe: 'as published by source',
    unit,
    sourceDataset: source,
    sourceTable: metricId,
    sourceVariable: metricId,
    geographyType,
    estimateType: unit === 'percent' ? 'percentage' : unit === 'USD' ? 'median' : 'rate',
    periodType: 'annual',
    externalDataSourceId: source,
    theme,
  };
}

function uniqueObservations(): readonly ThemeImpactPacketObservation[] {
  const byId = new Map<string, ThemeImpactPacketObservation>();
  for (const packet of RESEARCHED_THEME_IMPACT_PACKETS) {
    for (const row of packet.observations) {
      const prior = byId.get(row.observationId);
      if (
        prior &&
        (prior.estimate !== row.estimate ||
          prior.provenance.contentHash !== row.provenance.contentHash)
      ) {
        throw new Error(`conflicting packet observation definitions for ${row.observationId}`);
      }
      byId.set(row.observationId, row);
    }
  }
  return [...byId.values()];
}

function raceSlice(metricId: string): string | null {
  if (metricId.includes('-black-') || metricId.endsWith('-black-nation') || metricId.includes('black')) {
    if (metricId.includes('white')) return null;
    return 'black';
  }
  if (metricId.includes('-white-') || metricId.includes('white')) return 'white';
  if (metricId.includes('hispanic')) return 'hispanic';
  if (metricId.includes('asian')) return 'asian';
  return null;
}

function jurisdictionIdFromObservation(row: ThemeImpactPacketObservation): string {
  const parts = row.observationId.split(':');
  // obs:metric:geoType:geoId:period  OR obs:metric:nation:US:period
  if (parts.length >= 5 && parts[0] === 'obs') {
    return `${parts[2]}:${parts[3]}`;
  }
  throw new Error(`cannot parse jurisdiction from ${row.observationId}`);
}

async function main(): Promise<void> {
  const apply =
    process.env.UPSERT_RESEARCHED_PACKET_OBSERVATIONS === '1' && process.env.DRY_RUN !== '1';
  const observations = uniqueObservations();
  const seriesByMetric = new Map<string, SeriesSeed>();
  for (const row of observations) {
    if (!seriesByMetric.has(row.metricId)) {
      seriesByMetric.set(
        row.metricId,
        seriesSeedFor(row.metricId, row.unit, row.provenance.source),
      );
    }
  }

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    observationCount: observations.length,
    seriesCount: seriesByMetric.size,
    metricIds: [...seriesByMetric.keys()].sort(),
  };
  console.log(JSON.stringify(summary, null, 2));

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!apply) {
    console.log(
      'Dry-run only. Set UPSERT_RESEARCHED_PACKET_OBSERVATIONS=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  let seriesWritten = 0;
  let observationsWritten = 0;
  try {
    await client.query('BEGIN');
    for (const series of seriesByMetric.values()) {
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
          JSON.stringify({ seededBy: 'upsert-researched-packet-observations' }),
        ],
      );
      seriesWritten += 1;
    }

    for (const row of observations) {
      const jurisdictionId = jurisdictionIdFromObservation(row);
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
           source = EXCLUDED.source,
           source_url = EXCLUDED.source_url,
           metadata = EXCLUDED.metadata`,
        [
          row.observationId,
          row.metricId,
          jurisdictionId,
          jurisdictionId.startsWith('state:')
            ? 'state-2020'
            : jurisdictionId.startsWith('county:')
              ? 'county-2020'
              : 'nation-2020',
          row.referencePeriod,
          `theme-impact-packet:${row.referencePeriod}`,
          row.estimate,
          null,
          raceSlice(row.metricId),
          row.provenance.source,
          row.provenance.sourceUrl,
          row.provenance.retrievedAt,
          row.provenance.contentHash,
          JSON.stringify({
            label: row.label,
            humanCitation: row.provenance.humanCitation,
            seededBy: 'upsert-researched-packet-observations',
          }),
        ],
      );
      observationsWritten += 1;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(
    JSON.stringify(
      {
        mode: 'applied',
        seriesWritten,
        observationsWritten,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
