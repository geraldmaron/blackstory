/**
 * Seed the trustworthy national spine series (repo-zxjz.11).
 *
 * Assembles spine_series / spine_segments rows for the data domains that have
 * passed value-validation:
 *   1. Wealth ratio, mean per-capita   — DKKS 1860-2019 (single authentic backbone)
 *   2. Wealth ratio, median household   — SCF 1989-2022 (computed here as a derived
 *      ratio; kept as a SEPARATE spine, never spliced onto #1, because mean-per-capita
 *      and median-household measure different gaps)
 *   3. Homeownership (Black + White NH) — decennial 1900-2000 + ACS 2005-2024
 *   4. Life expectancy (Black + White)  — NCHS 1900-2021 (single source; race-label
 *      seam nonwhite/colored -> Black at 1980 documented in comparability_note)
 *   5. Turnout (Black + White)          — CPS A-1 1980-2020 (single source)
 *   6. Median household income (Black + White NH) — Census H-5 1967/1972-2024
 *      (real gap: no White NH series before 1972 in the source table)
 *   7. Poverty rate (Black + White NH) — Census Table 2 1959/1973-2024 (real
 *      gaps: Black 1960-1965 unpublished; White NH not published before 1973)
 *   8. Imprisonment rate (Black + White) — BJS 2010-2023 (real gap: 1978-2009
 *      not yet re-sourced after the repo-ypfp fabrication purge, tracked on
 *      repo-77sl; a seam note flags the unreconciled 2012->2013 methodology jump)
 *   9. Admissions share, Black (no white twin — single-race share metric) —
 *      BJS "Race of Prisoners Admitted" 1926-1986 (real gaps in years the NPS
 *      admission series never collected/published)
 *
 * Idempotent: re-running replaces the spine rows and upserts the SCF ratio.
 *
 * Usage (repo root):
 *   # Dry-run (default)
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/seed-spine-series-clean.ts
 *
 *   # Apply
 *   DRY_RUN=0 SEED_SPINE_CLEAN_APPLY=1 DATABASE_URL=postgresql://... \
 *     node --conditions development --import tsx \
 *     packages/ops-data/scripts/seed-spine-series-clean.ts
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.SEED_SPINE_CLEAN_APPLY === '1';

const SCF_RATIO_METRIC = 'scf-wealth-ratio-white-black-nation';
const SCF_SOURCE = 'fed-survey-consumer-finances';
const SCF_SOURCE_URL =
  'https://www.federalreserve.gov/econres/notes/feds-notes/greater-wealth-greater-uncertainty-changes-in-racial-inequality-in-the-survey-of-consumer-finances-accessible-20231018.htm';

type SpineSeed = {
  spineId: string;
  title: string;
  outcome: string;
  raceSlice: string | null;
  unit: string;
  definition: string;
  comparabilityNote: string;
  theme: string;
  segments: Array<{
    metricId: string;
    periodStart: string;
    periodEnd: string;
    priority: number;
    spliceNote: string;
    seamCheck: Record<string, unknown>;
  }>;
};

function hash(...parts: Array<string | number>): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

async function computeScfRatio(pool: pg.Pool) {
  const q = async (metric: string) => {
    const r = await pool.query<{ id: string; reference_period: string; estimate: string }>(
      `SELECT id, reference_period, estimate FROM bb_reference.statistical_observations
       WHERE metric_id=$1 ORDER BY reference_period`,
      [metric],
    );
    return r.rows;
  };
  const black = await q('scf-median-wealth-black-nation');
  const white = await q('scf-median-wealth-white-nation');
  const whiteByYear = new Map(white.map((r) => [r.reference_period, r]));
  const rows = [];
  for (const b of black) {
    const w = whiteByYear.get(b.reference_period);
    if (!w) continue;
    const bv = Number(b.estimate);
    const wv = Number(w.estimate);
    if (!bv) continue;
    rows.push({
      year: b.reference_period,
      value: wv / bv,
      inputIds: [w.id, b.id],
      whiteVal: wv,
      blackVal: bv,
    });
  }
  return rows;
}

async function main() {
  const conn = normalizePgConnectionString(process.env.DATABASE_URL!);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const now = new Date().toISOString();

  const scfRatio = await computeScfRatio(pool);
  if (scfRatio.length < 10) {
    throw new Error(`SCF ratio computed only ${scfRatio.length} years — expected 12; aborting.`);
  }

  const spines: SpineSeed[] = [
    {
      spineId: 'spine-wealth-ratio-white-black-us',
      title: 'The white-to-Black wealth ratio (mean per capita), 1860–2019',
      outcome: 'wealth-ratio-mean-percapita',
      raceSlice: null,
      unit: 'ratio',
      definition:
        'Ratio of white to Black per-capita wealth, national, from Derenoncourt, Kim, Kuhn & Schularick, "Wealth of Two Nations" (QJE 2024). Benchmark years only (census years, early state tax records, SCF survey years) — the authors do not publish an annual series.',
      comparabilityNote:
        'Single authentic source across the whole span; no splice. This is a MEAN per-capita ratio and is a different measure from the median-household ratio in spine-wealth-ratio-median-hh-white-black-us — the two are companions, never to be joined into one line. Note the 1929 benchmark lacks a usable white value in the source and is omitted from the segment (it would otherwise resolve to a spurious 0).',
      theme: 'wealth',
      segments: [
        {
          metricId: 'dkks-wealth-ratio-white-black-nation',
          periodStart: '1860',
          periodEnd: '2019',
          priority: 1,
          spliceNote: 'DKKS benchmark-year mean per-capita ratio, full span, single source.',
          seamCheck: { type: 'single-source', note: 'No seam; one source across 1860–2019.' },
        },
      ],
    },
    {
      spineId: 'spine-wealth-ratio-median-hh-white-black-us',
      title: 'The white-to-Black wealth ratio (median household), 1989–2022',
      outcome: 'wealth-ratio-median-household',
      raceSlice: null,
      unit: 'ratio',
      definition:
        'Ratio of white to Black median family net worth, national, computed from the Federal Reserve Survey of Consumer Finances triennial series (2022 dollars). Registered as derived_measurements with formula white_median / black_median.',
      comparabilityNote:
        'MEDIAN household measure — captures the typical family and is far more volatile than the mean per-capita ratio (spikes to ~10.8x after the 2008 crisis as Black median wealth collapsed). Deliberately a SEPARATE spine from the DKKS mean ratio; the two answer different questions and must not be spliced. 1989 (17.8x) is a genuine SCF outlier (Black median net worth of $9,200), retained as reported.',
      theme: 'wealth',
      segments: [
        {
          metricId: SCF_RATIO_METRIC,
          periodStart: '1989',
          periodEnd: '2022',
          priority: 1,
          spliceNote: 'SCF triennial median-household ratio, single source.',
          seamCheck: { type: 'single-source', note: 'No seam; one source across 1989–2022.' },
        },
      ],
    },
    {
      spineId: 'spine-homeownership-black-us',
      title: 'Black homeownership rate, 1900–2024',
      outcome: 'homeownership-rate',
      raceSlice: 'black',
      unit: 'percent',
      definition:
        'Share of Black households owning their home, national. Decennial census 1900–2000 spliced to ACS 1-year 2005–2024.',
      comparabilityNote:
        'Two instruments: decennial full-count (1900–2000) and ACS survey (2005–2024). No overlapping years; the seam is a 5-year adjacency at 2000→2005. Divergence at the seam is small and directionally consistent with the early-2000s ownership boom.',
      theme: 'housing',
      segments: [
        {
          metricId: 'census-decennial-homeownership-black-nation',
          periodStart: '1900',
          periodEnd: '2000',
          priority: 2,
          spliceNote: 'Decennial census full count; wins its own span (ACS does not cover it).',
          seamCheck: {
            type: 'adjacency',
            seam_year_from: '2000',
            seam_year_to: '2005',
            value_from: 46.3,
            value_to: 49.3,
            gap_years: 5,
            divergence_pct: Number((((49.3 - 46.3) / 46.3) * 100).toFixed(2)),
            note: 'Decennial 2000 (46.3%) to ACS 2005 (49.3%): +3.0pp over 5 years, plausible boom-era rise; instruments differ (full count vs survey).',
          },
        },
        {
          metricId: 'acs-homeownership-rate-black-nation',
          periodStart: '2005',
          periodEnd: '2024',
          priority: 1,
          spliceNote: 'ACS 1-year survey; wins 2005–2024 (no 2020 standard 1-year release).',
          seamCheck: {},
        },
      ],
    },
    {
      spineId: 'spine-homeownership-white-us',
      title: 'White (non-Hispanic) homeownership rate, 1900–2024',
      outcome: 'homeownership-rate',
      raceSlice: 'white-non-hispanic',
      unit: 'percent',
      definition:
        'Share of white non-Hispanic households owning their home, national. Decennial census 1900–2000 spliced to ACS 1-year 2005–2024.',
      comparabilityNote:
        'Same two-instrument structure as the Black spine. Seam is a 5-year adjacency at 2000→2005 (73.1%→74.8%, +1.7pp), small and boom-consistent.',
      theme: 'housing',
      segments: [
        {
          metricId: 'census-decennial-homeownership-white_nh-nation',
          periodStart: '1900',
          periodEnd: '2000',
          priority: 2,
          spliceNote: 'Decennial census full count.',
          seamCheck: {
            type: 'adjacency',
            seam_year_from: '2000',
            seam_year_to: '2005',
            value_from: 73.1,
            value_to: 74.8,
            gap_years: 5,
            divergence_pct: Number((((74.8 - 73.1) / 73.1) * 100).toFixed(2)),
            note: 'Decennial 2000 (73.1%) to ACS 2005 (74.8%): +1.7pp over 5 years.',
          },
        },
        {
          metricId: 'acs-homeownership-rate-white_nh-nation',
          periodStart: '2005',
          periodEnd: '2024',
          priority: 1,
          spliceNote: 'ACS 1-year survey.',
          seamCheck: {},
        },
      ],
    },
    {
      spineId: 'spine-life-expectancy-black-us',
      title: 'Black life expectancy at birth, 1900–2021',
      outcome: 'life-expectancy-birth',
      raceSlice: 'black',
      unit: 'years',
      definition:
        'Life expectancy at birth for the Black population, national, from NCHS historical life tables.',
      comparabilityNote:
        'Single NCHS source, but the race label changes over time: "nonwhite" (1900–1940, 1970), "colored" (1950–1960), and true "Black" only from 1980 on. Pre-1980 values are a nonwhite/colored PROXY for Black and should be read as such — this is a within-series definitional seam at 1980, not a source splice. Includes the real 2015–2017 stagnation and the 2020–2021 COVID collapse (74.8→70.8).',
      theme: 'health',
      segments: [
        {
          metricId: 'nchs-life-expectancy-birth-black-nation',
          periodStart: '1900',
          periodEnd: '2021',
          priority: 1,
          spliceNote:
            'Single source; race-label proxy seam at 1980 (nonwhite/colored before, Black after) documented in comparability_note.',
          seamCheck: {
            type: 'definitional',
            seam_year: '1980',
            note: 'Label transitions nonwhite/colored -> Black at 1980; pre-1980 is a proxy.',
          },
        },
      ],
    },
    {
      spineId: 'spine-life-expectancy-white-us',
      title: 'White life expectancy at birth, 1900–2021',
      outcome: 'life-expectancy-birth',
      raceSlice: 'white',
      unit: 'years',
      definition:
        'Life expectancy at birth for the white population, national, from NCHS historical life tables.',
      comparabilityNote:
        'Single NCHS source. White labeling is stable across the span (unlike the Black spine). Includes the 2020–2021 COVID decline (78.8→76.1).',
      theme: 'health',
      segments: [
        {
          metricId: 'nchs-life-expectancy-birth-white-nation',
          periodStart: '1900',
          periodEnd: '2021',
          priority: 1,
          spliceNote: 'Single source, stable white definition.',
          seamCheck: { type: 'single-source', note: 'No seam.' },
        },
      ],
    },
    {
      spineId: 'spine-turnout-black-us',
      title: 'Black voter turnout (citizen), presidential years 1980–2020',
      outcome: 'voter-turnout-citizen',
      raceSlice: 'black',
      unit: 'percent',
      definition:
        'Reported voting rate as a share of Black citizens, presidential elections, from Census CPS Table A-1.',
      comparabilityNote:
        'Single CPS source. COVERAGE GAP: only presidential years 1980–2020 landed; the 1964/68/72/76 elections and 2024 are not yet ingested (tracked on repo-zxjz.8). Do not present as a full 1964-onward series until backfilled.',
      theme: 'political-participation',
      segments: [
        {
          metricId: 'cps-a1-turnout-black-nation',
          periodStart: '1980',
          periodEnd: '2020',
          priority: 1,
          spliceNote: 'CPS A-1 citizen turnout; single source; pre-1980 not yet ingested.',
          seamCheck: {
            type: 'single-source',
            note: 'No seam; coverage 1980–2020 only (pre-1980 + 2024 pending, repo-zxjz.8).',
          },
        },
      ],
    },
    {
      spineId: 'spine-turnout-white-us',
      title: 'White voter turnout (citizen), presidential years 1980–2020',
      outcome: 'voter-turnout-citizen',
      raceSlice: 'white',
      unit: 'percent',
      definition:
        'Reported voting rate as a share of white citizens, presidential elections, from Census CPS Table A-1.',
      comparabilityNote:
        'Single CPS source. Same 1980–2020 coverage gap as the Black turnout spine (repo-zxjz.8).',
      theme: 'political-participation',
      segments: [
        {
          metricId: 'cps-a1-turnout-white-nation',
          periodStart: '1980',
          periodEnd: '2020',
          priority: 1,
          spliceNote: 'CPS A-1 citizen turnout; single source.',
          seamCheck: {
            type: 'single-source',
            note: 'No seam; coverage 1980–2020 only.',
          },
        },
      ],
    },
    {
      spineId: 'spine-median-hh-income-black-us',
      title: 'Black median household income, 1967–2024',
      outcome: 'median-household-income',
      raceSlice: 'black',
      unit: 'USD (2024 dollars)',
      definition:
        'Median household income for Black householders, national, in 2024 constant dollars, from Census CPS ASEC Table H-5.',
      comparabilityNote:
        'Single Census source across the whole span; no splice. Re-ingested from the real published table after repo-gfyn found the prior fixture smoothed/rounded to 5-year sampled points — this is now the full annual series.',
      theme: 'wealth',
      segments: [
        {
          metricId: 'census-h5-median-hh-income-black-nation',
          periodStart: '1967',
          periodEnd: '2024',
          priority: 1,
          spliceNote: 'Census H-5, single source, full annual span.',
          seamCheck: { type: 'single-source', note: 'No seam.' },
        },
      ],
    },
    {
      spineId: 'spine-median-hh-income-white-us',
      title: 'White (non-Hispanic) median household income, 1972–2024',
      outcome: 'median-household-income',
      raceSlice: 'white-non-hispanic',
      unit: 'USD (2024 dollars)',
      definition:
        'Median household income for White non-Hispanic householders, national, in 2024 constant dollars, from Census CPS ASEC Table H-5.',
      comparabilityNote:
        'Single Census source. REAL GAP: the source table has no White-non-Hispanic-specific series before 1972 (only a "White" series that includes Hispanic white households, a different race/ethnicity slice, so it is not substituted in here); 1983 is also unpublished ("N") in the source and is omitted rather than interpolated.',
      theme: 'wealth',
      segments: [
        {
          metricId: 'census-h5-median-hh-income-white-nh-nation',
          periodStart: '1972',
          periodEnd: '2024',
          priority: 1,
          spliceNote: 'Census H-5, single source; coverage starts 1972 in the published table.',
          seamCheck: {
            type: 'single-source',
            note: 'No seam; coverage 1972–2024 only (no White-NH series before 1972; 1983 unpublished).',
          },
        },
      ],
    },
    {
      spineId: 'spine-poverty-rate-black-us',
      title: 'Black poverty rate, 1959–2024',
      outcome: 'poverty-rate',
      raceSlice: 'black',
      unit: 'percent',
      definition:
        'Share of the Black population below the poverty line, national, from Census CPS ASEC Table 2.',
      comparabilityNote:
        'Single Census source. REAL GAP: 1960–1965 were never published in the source table (jumps from 1959 to 1966). Re-ingested from the real published table after repo-gfyn found the prior fixture smoothed to a perfectly linear recent tail.',
      theme: 'wealth',
      segments: [
        {
          metricId: 'census-p2-poverty-rate-black-nation',
          periodStart: '1959',
          periodEnd: '2024',
          priority: 1,
          spliceNote: 'Census Table 2, single source; 1960–1965 unpublished gap preserved.',
          seamCheck: {
            type: 'single-source',
            note: 'No seam; genuine reporting gap 1960–1965 (source never published those years).',
          },
        },
      ],
    },
    {
      spineId: 'spine-poverty-rate-white-us',
      title: 'White (non-Hispanic) poverty rate, 1973–2024',
      outcome: 'poverty-rate',
      raceSlice: 'white-non-hispanic',
      unit: 'percent',
      definition:
        'Share of the White non-Hispanic population below the poverty line, national, from Census CPS ASEC Table 2.',
      comparabilityNote:
        'Single Census source. REAL GAP: no White-non-Hispanic-specific series before 1973 in the source table.',
      theme: 'wealth',
      segments: [
        {
          metricId: 'census-p2-poverty-rate-white-nh-nation',
          periodStart: '1973',
          periodEnd: '2024',
          priority: 1,
          spliceNote: 'Census Table 2, single source; coverage starts 1973 in the published table.',
          seamCheck: {
            type: 'single-source',
            note: 'No seam; coverage 1973–2024 only (no White-NH series before 1973).',
          },
        },
      ],
    },
    {
      spineId: 'spine-imprisonment-rate-black-us',
      title: 'Black imprisonment rate, 2010–2023',
      outcome: 'imprisonment-rate',
      raceSlice: 'black',
      unit: 'per 100,000 residents',
      definition:
        'Sentenced prisoners under state or federal jurisdiction per 100,000 Black U.S. residents, national, from BJS National Prisoner Statistics.',
      comparabilityNote:
        'REAL GAP: 1978–2009 was purged as fabricated (repo-ypfp) and has not yet been re-sourced from real annual BJS bulletins (tracked on repo-77sl) — do not present this as a full 1978-present series. UNRESOLVED SEAM at 2012→2013 (1377 to 1818, a 32% jump): 2010-2012 comes from "Prisoners in 2020" Table 5 ("all ages" basis) while 2013-2023 comes from the pre-existing NPS series; the basis difference has not been reconciled and both segments are given equal priority pending investigation.',
      theme: 'justice',
      segments: [
        {
          metricId: 'bjs-imprisonment-rate-black-nation',
          periodStart: '2010',
          periodEnd: '2023',
          priority: 1,
          spliceNote:
            'BJS NPS, single metric ID but two source vintages internally (see comparability_note for the unreconciled 2012->2013 seam).',
          seamCheck: {
            type: 'unresolved',
            seam_year_from: '2012',
            seam_year_to: '2013',
            value_from: 1377,
            value_to: 1818,
            divergence_pct: Number((((1818 - 1377) / 1377) * 100).toFixed(2)),
            note: 'Possible all-ages vs adults-18+ basis mismatch between two legitimate BJS tables; not yet reconciled. Also: 1978-2009 is a real, unfilled gap (repo-77sl).',
          },
        },
      ],
    },
    {
      spineId: 'spine-imprisonment-rate-white-us',
      title: 'White imprisonment rate, 2010–2023',
      outcome: 'imprisonment-rate',
      raceSlice: 'white',
      unit: 'per 100,000 residents',
      definition:
        'Sentenced prisoners under state or federal jurisdiction per 100,000 white U.S. residents, national, from BJS National Prisoner Statistics.',
      comparabilityNote:
        'Same structure and same caveats as the Black imprisonment spine: 1978-2009 gap (repo-77sl) and an unreconciled 2012->2013 seam (238 to 295, a comparatively larger +24% jump on a smaller base).',
      theme: 'justice',
      segments: [
        {
          metricId: 'bjs-imprisonment-rate-white-nation',
          periodStart: '2010',
          periodEnd: '2023',
          priority: 1,
          spliceNote: 'BJS NPS, single metric ID, same seam caveat as the Black twin.',
          seamCheck: {
            type: 'unresolved',
            seam_year_from: '2012',
            seam_year_to: '2013',
            value_from: 238,
            value_to: 295,
            divergence_pct: Number((((295 - 238) / 238) * 100).toFixed(2)),
            note: 'Same unreconciled basis-mismatch caveat as the Black twin; 1978-2009 gap tracked on repo-77sl.',
          },
        },
      ],
    },
    {
      spineId: 'spine-admissions-share-black-us',
      title: 'Black share of prison admissions, 1926–1986',
      outcome: 'admissions-share',
      raceSlice: 'black',
      unit: 'percent',
      definition:
        'Black share of total State and Federal prison admissions (race-known base), national, from the BJS "Race of Prisoners Admitted to State and Federal Institutions, 1926-86" bulletin (Langan, NCJ-125618, Table 2).',
      comparabilityNote:
        'Single primary source, real reporting gaps preserved (no data 1951-59, 1961-63, 1965-69, 1971-73) — not to be confused with a rate; this is a SHARE of admissions, not admissions per capita. No white twin: the source reports White/Black/Other as shares of one total rather than as independent per-capita rates, so a "white share" spine would just be the complement and add no information.',
      theme: 'justice',
      segments: [
        {
          metricId: 'bjs-admissions-share-black-nation',
          periodStart: '1926',
          periodEnd: '1986',
          priority: 1,
          spliceNote: 'BJS Langan bulletin Table 2, single source, real gaps preserved.',
          seamCheck: {
            type: 'single-source',
            note: 'No seam; genuine multi-year reporting gaps in the underlying NPS admission series.',
          },
        },
      ],
    },
  ];

  const plan = {
    scfRatioYears: scfRatio.map((r) => r.year),
    scfRatioSample: scfRatio.slice(0, 3).map((r) => `${r.year}=${r.value.toFixed(3)}`),
    spineCount: spines.length,
    segmentCount: spines.reduce((n, s) => n + s.segments.length, 0),
    spineIds: spines.map((s) => s.spineId),
  };
  console.log(JSON.stringify({ dryRun: DRY_RUN || !APPLY, plan }, null, 2));

  if (DRY_RUN || !APPLY) {
    console.log('\nDry-run only. Set DRY_RUN=0 SEED_SPINE_CLEAN_APPLY=1 to apply.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. SCF ratio statistical_series
    await client.query(
      `INSERT INTO bb_reference.statistical_series
         (metric_id, metric_definition, universe, unit, source_dataset, source_table, source_variable,
          geography_type, estimate_type, period_type, external_data_source_id, theme, metadata)
       VALUES ($1,$2,$3,'ratio',$4,'SCF bulletin (derived)','median_net_worth_white / median_net_worth_black',
          'nation','ratio','point-in-time',$4,'wealth', $5::jsonb)
       ON CONFLICT (metric_id) DO UPDATE SET updated_at=now()`,
      [
        SCF_RATIO_METRIC,
        'White-to-Black median family net worth ratio, national, computed from SCF median wealth series (2022 dollars).',
        'as published by source',
        SCF_SOURCE,
        JSON.stringify({ raceEthnicitySlice: null, derived: true }),
      ],
    );

    // 2. SCF ratio observations + derived_measurements audit
    for (const r of scfRatio) {
      const obsId = `obs:${SCF_RATIO_METRIC}:nation:US:${r.year}`;
      const ch = hash(SCF_RATIO_METRIC, r.year, r.whiteVal, r.blackVal);
      await client.query(
        `INSERT INTO bb_reference.statistical_observations
           (id, metric_id, jurisdiction_id, boundary_version, reference_period, dataset_vintage,
            estimate, race_ethnicity_slice, status, source, source_url, retrieved_at, content_hash, metadata)
         VALUES ($1,$2,'nation:US','nation-2022',$3,$4,$5,NULL,'observed',$6,$7,$8,$9,$10::jsonb)
         ON CONFLICT (id) DO UPDATE SET estimate=EXCLUDED.estimate, content_hash=EXCLUDED.content_hash`,
        [
          obsId,
          SCF_RATIO_METRIC,
          r.year,
          'SCF triennial bulletin — derived white/black median net worth ratio (2022 dollars)',
          r.value,
          SCF_SOURCE,
          SCF_SOURCE_URL,
          now,
          ch,
          JSON.stringify({
            humanCitation: `White-to-Black median family net worth ratio, ${r.year}, computed from SCF (2022 dollars): ${r.whiteVal} / ${r.blackVal}.`,
            derived: true,
          }),
        ],
      );
      const dmId = `dm:${SCF_RATIO_METRIC}:${r.year}`;
      await client.query(
        `INSERT INTO bb_reference.derived_measurements
           (id, method_id, method_version, input_observation_ids, value, formula, assumptions, status,
            generated_at, jurisdiction_id, reference_period, metric_id, source, source_url, content_hash, metadata)
         VALUES ($1,'ratio-of-medians','1',$2,$3,$4,$5,'derived',$6,'nation:US',$7,$8,$9,$10,$11,$12::jsonb)
         ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value, content_hash=EXCLUDED.content_hash`,
        [
          dmId,
          r.inputIds,
          r.value,
          'white_median_net_worth / black_median_net_worth',
          ['Both inputs are SCF median family net worth in 2022 dollars, same vintage.'],
          now,
          r.year,
          SCF_RATIO_METRIC,
          SCF_SOURCE,
          SCF_SOURCE_URL,
          hash('dm', SCF_RATIO_METRIC, r.year, r.value),
          JSON.stringify({ whiteInput: r.whiteVal, blackInput: r.blackVal }),
        ],
      );
    }

    // 3. spine_series + spine_segments (replace)
    for (const s of spines) {
      await client.query(`DELETE FROM bb_reference.spine_segments WHERE spine_id=$1`, [s.spineId]);
      await client.query(`DELETE FROM bb_reference.spine_series WHERE spine_id=$1`, [s.spineId]);
      await client.query(
        `INSERT INTO bb_reference.spine_series
           (spine_id, title, outcome, race_ethnicity_slice, geography_type, unit, definition, comparability_note, theme, status)
         VALUES ($1,$2,$3,$4,'nation',$5,$6,$7,$8,'review')`,
        [
          s.spineId,
          s.title,
          s.outcome,
          s.raceSlice,
          s.unit,
          s.definition,
          s.comparabilityNote,
          s.theme,
        ],
      );
      let i = 0;
      for (const seg of s.segments) {
        await client.query(
          `INSERT INTO bb_reference.spine_segments
             (id, spine_id, metric_id, period_start, period_end, priority, splice_note, seam_check)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
          [
            `${s.spineId}:seg${i}`,
            s.spineId,
            seg.metricId,
            seg.periodStart,
            seg.periodEnd,
            seg.priority,
            seg.spliceNote,
            JSON.stringify(seg.seamCheck),
          ],
        );
        i += 1;
      }
    }

    await client.query('COMMIT');
    console.log(
      `\nApplied: SCF ratio (${scfRatio.length} obs + derived), ${spines.length} spines, ${plan.segmentCount} segments.`,
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
