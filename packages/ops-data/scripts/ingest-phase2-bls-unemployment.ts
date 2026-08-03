/**
 * BLS CPS unemployment rate by race ingest for Phase 2 national observations.
 * Fetches monthly seasonally-adjusted (SA) unemployment rates for Black and White
 * populations from BLS CPS and computes annual averages.
 *
 * Series:
 *   LNS14000006: Black or African American unemployment rate, 16+ years, SA, monthly
 *   LNS14000003: White unemployment rate, 16+ years, SA, monthly
 *
 * Target metrics:
 *   bls-unemployment-rate-black-nation (1972–present)
 *   bls-unemployment-rate-white-nation (1954–present)
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase2-bls-unemployment.ts
 *
 *   # Apply to Postgres
 *   DRY_RUN=0 INGEST_PHASE2_BLS_UNEMPLOYMENT_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/ingest-phase2-bls-unemployment.ts
 */
import { createHash } from 'node:crypto';
import pg from 'pg';

interface BlsSeriesData {
  readonly seriesId: string;
  readonly seriesTitle: string;
  readonly data: Array<{
    readonly year: string;
    readonly period: string;
    readonly value: string;
    readonly footnotes?: Array<{ readonly code: string; readonly text: string }>;
  }>;
}

interface BlsApiResponse {
  readonly status: string;
  readonly responseTime: number;
  readonly message?: string[];
  readonly Results?: {
    readonly series: BlsSeriesData[];
  };
}

interface AnnualAverage {
  readonly year: number;
  readonly rate: number;
  readonly monthCount: number;
}

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

async function fetchBlsData(seriesIds: readonly string[]): Promise<Map<string, BlsSeriesData>> {
  const results = new Map<string, BlsSeriesData>();

  for (const seriesId of seriesIds) {
    try {
      // BLS API v2: fetch multiple batches from 1950 to present
      let allData: BlsSeriesData['data'] = [];
      const currentYear = new Date().getFullYear();

      // Fetch in 20-year batches to cover full history from 1950
      for (let startYear = 1950; startYear <= currentYear; startYear += 20) {
        const endYear = Math.min(startYear + 19, currentYear);

        // BLS API v2 requires POST with JSON body
        const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seriesid: [seriesId],
            startyear: startYear,
            endyear: endYear,
          }),
        });

        if (!response.ok) {
          console.error(
            `BLS API error for ${seriesId}: ${response.status} (${startYear}-${endYear})`,
          );
          continue;
        }

        const json = (await response.json()) as BlsApiResponse;
        if (json.status !== 'REQUEST_SUCCEEDED') {
          console.error(
            `BLS API request failed for ${seriesId} (${startYear}-${endYear})`,
            json.message,
          );
          continue;
        }

        if (!json.Results?.series[0]) {
          // No data for this period, which is OK if it's before data started
          continue;
        }

        const data = json.Results.series[0].data;
        allData = [...data, ...allData];
      }

      if (allData.length > 0) {
        results.set(seriesId, {
          seriesId,
          seriesTitle: seriesId,
          data: allData.sort((a, b) => {
            const yearCmp = Number(a.year) - Number(b.year);
            if (yearCmp !== 0) return yearCmp;
            const periodA = Number(a.period.replace('M', ''));
            const periodB = Number(b.period.replace('M', ''));
            return periodA - periodB;
          }),
        });
      }
    } catch (error) {
      console.error(`Error fetching ${seriesId}:`, error);
    }
  }

  return results;
}

function computeAnnualAverages(monthlyData: BlsSeriesData['data']): Map<number, AnnualAverage> {
  const byYear = new Map<number, number[]>();

  for (const record of monthlyData) {
    const year = Number(record.year);
    const period = record.period;

    // Skip non-monthly periods
    if (!period.startsWith('M')) continue;

    const monthNum = Number(period.slice(1));
    if (monthNum < 1 || monthNum > 12) continue;

    const value = Number(record.value);
    if (isNaN(value)) continue;

    if (!byYear.has(year)) {
      byYear.set(year, []);
    }
    byYear.get(year)!.push(value);
  }

  const annualAverages = new Map<number, AnnualAverage>();
  for (const [year, values] of byYear.entries()) {
    if (values.length > 0) {
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      annualAverages.set(year, {
        year,
        rate: Number(average.toFixed(2)),
        monthCount: values.length,
      });
    }
  }

  return annualAverages;
}

interface BlsObservation {
  readonly id: string;
  readonly metricId: string;
  readonly raceEthnicitySlice: string;
  readonly referencePeriod: string;
  readonly estimate: number;
  readonly source: string;
  readonly sourceUrl: string;
  readonly retrievedAt: Date;
  readonly contentHash: string;
  readonly metadata: {
    readonly seriesId: string;
    readonly dataType: string;
    readonly methodology: string;
  };
}

function createObservations(
  metricId: string,
  raceEthnicitySlice: string,
  seriesId: string,
  annualAverages: Map<number, AnnualAverage>,
): BlsObservation[] {
  const observations: BlsObservation[] = [];
  const retrievedAt = new Date();

  for (const [year, annual] of annualAverages) {
    const id = `bls-cps-${seriesId}-${year}`;
    const contentHash = createHash('sha256')
      .update(JSON.stringify({ seriesId, year, rate: annual.rate }))
      .digest('hex')
      .slice(0, 16);

    observations.push({
      id,
      metricId,
      raceEthnicitySlice,
      referencePeriod: String(year),
      estimate: annual.rate,
      source: 'Bureau of Labor Statistics (BLS) Current Population Survey (CPS)',
      sourceUrl: `https://www.bls.gov/cps/`,
      retrievedAt,
      contentHash,
      metadata: {
        seriesId,
        dataType: 'unemployment rate (seasonally adjusted)',
        methodology: `Annual average of ${annual.monthCount} monthly observations`,
      },
    });
  }

  return observations;
}

async function applyObservations(
  observations: BlsObservation[],
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

    // Upsert series definitions
    const seriesDefinitions = [
      {
        metricId: 'bls-unemployment-rate-black-nation',
        metricDefinition: 'Unemployment rate for Black or African American population, 16+ years',
        universe: 'civilian labor force',
        unit: 'percent',
        sourceDataset: 'BLS Current Population Survey (CPS)',
        sourceTable: 'Table A-1',
        sourceVariable: 'LNS14000006',
        geographyType: 'nation',
        estimateType: 'percentage',
        periodType: 'annual',
        externalDataSourceId: 'bls-laus-unemployment',
        theme: 'labor',
        raceEthnicitySlice: 'black_alone',
      },
      {
        metricId: 'bls-unemployment-rate-white-nation',
        metricDefinition: 'Unemployment rate for White population, 16+ years',
        universe: 'civilian labor force',
        unit: 'percent',
        sourceDataset: 'BLS Current Population Survey (CPS)',
        sourceTable: 'Table A-1',
        sourceVariable: 'LNS14000003',
        geographyType: 'nation',
        estimateType: 'percentage',
        periodType: 'annual',
        externalDataSourceId: 'bls-laus-unemployment',
        theme: 'labor',
        raceEthnicitySlice: 'white_alone',
      },
    ];

    for (const series of seriesDefinitions) {
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
          JSON.stringify({ raceEthnicitySlice: series.raceEthnicitySlice }),
        ],
      );
    }

    // Upsert observations for national level (jurisdiction_id = 'nation')
    for (const obs of observations) {
      await client.query(
        `INSERT INTO bb_reference.statistical_observations
          (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage,
           estimate, margin_of_error, race_ethnicity_slice, status, source, source_url,
           retrieved_at, content_hash, metadata)
         VALUES ($1,$2,'nation',$4,$5,$6,$7,$8,$9,'observed',$10,$11,$12::timestamptz,$13,$14::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           estimate = EXCLUDED.estimate,
           content_hash = EXCLUDED.content_hash,
           retrieved_at = EXCLUDED.retrieved_at,
           metadata = EXCLUDED.metadata`,
        [
          obs.id,
          obs.metricId,
          undefined,
          null,
          obs.referencePeriod,
          null,
          obs.estimate,
          null,
          obs.raceEthnicitySlice,
          obs.source,
          obs.sourceUrl,
          obs.retrievedAt,
          obs.contentHash,
          JSON.stringify(obs.metadata),
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
    process.env.INGEST_PHASE2_BLS_UNEMPLOYMENT_APPLY === '1' && process.env.DRY_RUN !== '1';

  console.log('Fetching BLS unemployment data by race...');
  const blsData = await fetchBlsData(['LNS14000006', 'LNS14000003']);

  if (blsData.size !== 2) {
    console.error(`ERROR: Expected 2 BLS series, got ${blsData.size}`);
    process.exitCode = 1;
    return;
  }

  // Process Black unemployment (LNS14000006)
  const blackData = blsData.get('LNS14000006');
  const blackAnnuals = blackData ? computeAnnualAverages(blackData.data) : new Map();
  const blackObservations = createObservations(
    'bls-unemployment-rate-black-nation',
    'black_alone',
    'LNS14000006',
    blackAnnuals,
  );

  // Process White unemployment (LNS14000003)
  const whiteData = blsData.get('LNS14000003');
  const whiteAnnuals = whiteData ? computeAnnualAverages(whiteData.data) : new Map();
  const whiteObservations = createObservations(
    'bls-unemployment-rate-white-nation',
    'white_alone',
    'LNS14000003',
    whiteAnnuals,
  );

  const allObservations = [...blackObservations, ...whiteObservations];

  // Sanity checks
  const black1983 = blackAnnuals.get(1983);
  const black2019 = blackAnnuals.get(2019);
  const white2019 = whiteAnnuals.get(2019);

  const summary: Record<string, unknown> = {
    ok: true,
    dryRun: !apply,
    blackObservations: blackObservations.length,
    whiteObservations: whiteObservations.length,
    totalObservations: allObservations.length,
    yearsRange: {
      black: [Math.min(...blackAnnuals.keys()), Math.max(...blackAnnuals.keys())],
      white: [Math.min(...whiteAnnuals.keys()), Math.max(...whiteAnnuals.keys())],
    },
    sanityChecks: {
      black1983: black1983
        ? {
            rate: black1983.rate,
            expected: '~19–20%',
            ok: black1983.rate >= 18 && black1983.rate <= 21,
          }
        : null,
      black2019: black2019
        ? { rate: black2019.rate, expected: '~6.1%', ok: Math.abs(black2019.rate - 6.1) <= 0.5 }
        : null,
      white2019: white2019
        ? { rate: white2019.rate, expected: '~3.3%', ok: Math.abs(white2019.rate - 3.3) <= 0.5 }
        : null,
      blackWhiteRatio2019:
        black2019 && white2019
          ? {
              ratio: Number((black2019.rate / white2019.rate).toFixed(2)),
              expected: '~2.0 ± 0.4',
              ok: black2019.rate / white2019.rate >= 1.6 && black2019.rate / white2019.rate <= 2.4,
            }
          : null,
    },
  };

  // Check acceptance criteria
  if (blackObservations.length < 50) {
    summary.ok = false;
    summary.error = `Black series has only ${blackObservations.length} observations (need >= 50)`;
  }
  if (whiteObservations.length < 65) {
    summary.ok = false;
    summary.error = `White series has only ${whiteObservations.length} observations (need >= 65)`;
  }

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log(
      'Dry-run only. Set INGEST_PHASE2_BLS_UNEMPLOYMENT_APPLY=1 DRY_RUN=0 DATABASE_URL=… to upsert.',
    );
    return;
  }

  if (!summary.ok) {
    console.error('Sanity checks failed, refusing to apply.');
    process.exitCode = 1;
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or APP_DATABASE_URL) required for apply mode');
  }

  const written = await applyObservations(allObservations, databaseUrl);
  summary.appliedObservations = written;

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
