/**
 * Load bulk discovery fixtures into Supabase bb_research.landscape_candidates.
 *
 * Research-lane only: never writes bb_public.* or activates releases.
 *
 * Default is dry-run (plan only). Production writes require:
 *   DRY_RUN=0 LOAD_BULK_CANDIDATES_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   # Plan DC sites from git fixture (default)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/load-bulk-candidates-to-supabase.ts --lane=dc-sites
 *
 *   # Plan all wired lanes
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/load-bulk-candidates-to-supabase.ts --all
 *
 *   # Fetch fresh HBCU rows then load (network)
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/load-bulk-candidates-to-supabase.ts --lane=hbcu --fetch
 *
 *   # Apply to local Supabase after migration
 *   DRY_RUN=0 LOAD_BULK_CANDIDATES_APPLY=1 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     node --conditions development --import tsx \
 *     packages/firebase/scripts/load-bulk-candidates-to-supabase.ts --lane=dc-sites
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  DEFAULT_BULK_FIXTURES,
  mapBulkFixtureToLoadPlan,
  type BulkFixtureFile,
  type BulkLane,
  type BulkFixtureLoadPlan,
} from './lib/bulk-candidates-supabase.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const CACHE_DIR = join(REPO_ROOT, '.cache/bulk-candidates-supabase');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.LOAD_BULK_CANDIDATES_APPLY === '1';

type LaneArg = BulkLane | 'all';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((entry) => entry.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function resolveFixturePath(lane: BulkLane, explicit?: string): string {
  const relative = explicit ?? DEFAULT_BULK_FIXTURES[lane];
  if (!relative || relative.length === 0) {
    throw new Error(`no default fixture for lane ${lane}; pass --fixture=`);
  }
  const absolute = join(REPO_ROOT, relative);
  if (!existsSync(absolute)) {
    throw new Error(`fixture not found: ${absolute}`);
  }
  return absolute;
}

function readFixture(path: string): BulkFixtureFile {
  return JSON.parse(readFileSync(path, 'utf8')) as BulkFixtureFile;
}

async function fetchFreshFixture(lane: BulkLane): Promise<{ readonly fixturePath: string }> {
  const { execFileSync } = await import('node:child_process');
  const args = [
    '--conditions',
    'development',
    '--import',
    'tsx',
    'packages/firebase/scripts/import-bulk-source-programs.ts',
    `--lane=${lane}`,
  ];
  if (lane === 'hbcu') {
    args.push('--from-fixture');
  }
  execFileSync('node', args, { cwd: REPO_ROOT, stdio: 'inherit' });
  const candidatesDir = join(REPO_ROOT, 'packages/firebase/fixtures/discovery-candidates');
  const today = new Date().toISOString().slice(0, 10);
  const expected = join(candidatesDir, `bulk-${lane}-${today}.json`);
  if (existsSync(expected)) {
    return { fixturePath: expected };
  }
  const { readdirSync } = await import('node:fs');
  const matches = readdirSync(candidatesDir)
    .filter((name) => name.startsWith(`bulk-${lane}-`) && name.endsWith('.json'))
    .sort()
    .reverse();
  const latest = matches[0];
  if (!latest) {
    throw new Error(`fetch completed but no bulk-${lane}-*.json fixture found`);
  }
  return { fixturePath: join(candidatesDir, latest) };
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

async function upsertPlan(client: pg.PoolClient, plan: BulkFixtureLoadPlan): Promise<void> {
  const run = plan.run;
  await client.query(
    `INSERT INTO bb_research.source_program_runs
      (id, lane, source_program_id, source_program_name, custodian, license, canonical_url,
       attribution, retrieved_at, fixture_path, rows_fetched, candidate_count, dropped_count,
       summary, methodology_notes, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
     ON CONFLICT (id) DO UPDATE SET
       source_program_name = EXCLUDED.source_program_name,
       custodian = EXCLUDED.custodian,
       license = EXCLUDED.license,
       canonical_url = EXCLUDED.canonical_url,
       attribution = EXCLUDED.attribution,
       retrieved_at = EXCLUDED.retrieved_at,
       fixture_path = EXCLUDED.fixture_path,
       rows_fetched = EXCLUDED.rows_fetched,
       candidate_count = EXCLUDED.candidate_count,
       dropped_count = EXCLUDED.dropped_count,
       summary = EXCLUDED.summary,
       methodology_notes = EXCLUDED.methodology_notes,
       updated_at = now()`,
    [
      run.id,
      run.lane,
      run.source_program_id,
      run.source_program_name,
      run.custodian,
      run.license,
      run.canonical_url,
      run.attribution,
      run.retrieved_at,
      run.fixture_path,
      run.rows_fetched,
      run.candidate_count,
      run.dropped_count,
      JSON.stringify(run.summary),
      JSON.stringify(run.methodology_notes),
    ],
  );

  for (const capture of plan.captures) {
    await client.query(
      `INSERT INTO bb_research.source_acquisition_captures
        (id, run_id, url, content_sha256, bytes, cached_as, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         url = EXCLUDED.url,
         content_sha256 = EXCLUDED.content_sha256,
         bytes = EXCLUDED.bytes,
         cached_as = EXCLUDED.cached_as,
         fetched_at = EXCLUDED.fetched_at`,
      [
        capture.id,
        capture.run_id,
        capture.url,
        capture.content_sha256,
        capture.bytes,
        capture.cached_as,
        capture.fetched_at,
      ],
    );
  }

  const batchSize = 50;
  for (let index = 0; index < plan.candidates.length; index += batchSize) {
    const batch = plan.candidates.slice(index, index + batchSize);
    for (const candidate of batch) {
      await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           lat, lng, canonical_url, research_lane_only, status, provenance, payload,
           discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())
         ON CONFLICT (id) DO UPDATE SET
           run_id = EXCLUDED.run_id,
           display_name = EXCLUDED.display_name,
           kind = EXCLUDED.kind,
           summary = EXCLUDED.summary,
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           canonical_url = EXCLUDED.canonical_url,
           provenance = EXCLUDED.provenance,
           payload = EXCLUDED.payload,
           discovered_at = EXCLUDED.discovered_at,
           updated_at = now()`,
        [
          candidate.id,
          candidate.run_id,
          candidate.lane,
          candidate.source_program_id,
          candidate.source_item_id,
          candidate.display_name,
          candidate.kind,
          candidate.summary,
          candidate.lat,
          candidate.lng,
          candidate.canonical_url,
          candidate.research_lane_only,
          candidate.status,
          JSON.stringify(candidate.provenance),
          JSON.stringify(candidate.payload),
          candidate.discovered_at,
        ],
      );
    }
  }
}

async function loadLane(lane: BulkLane, options: { readonly fetch: boolean; readonly fixture?: string }) {
  let fixturePath = resolveFixturePath(lane, options.fixture);
  if (options.fetch) {
    if (lane === 'greenbook' || lane === 'hbcu' || lane === 'dc-sites') {
      const fetched = await fetchFreshFixture(lane);
      fixturePath = fetched.fixturePath;
    } else {
      throw new Error(`--fetch is not supported for lane ${lane}`);
    }
  }

  const fixture = readFixture(fixturePath);
  const plan = mapBulkFixtureToLoadPlan({
    fixture,
    lane,
    fixturePath: fixturePath.slice(REPO_ROOT.length + 1),
  });

  mkdirSync(CACHE_DIR, { recursive: true });
  const planPath = join(CACHE_DIR, `${lane}-load-plan.json`);
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log(`Lane: ${lane}`);
  console.log(`Fixture: ${fixturePath}`);
  console.log(`Run id: ${plan.run.id}`);
  console.log(`Captures: ${plan.captures.length}`);
  console.log(`Candidates: ${plan.candidates.length}`);
  console.log(`Plan written: ${planPath}`);

  if (DRY_RUN) {
    console.log('DRY_RUN=1 (default): no database writes. Set DRY_RUN=0 LOAD_BULK_CANDIDATES_APPLY=1 to apply.');
    return plan;
  }

  if (!APPLY) {
    console.error('Refusing to write: set LOAD_BULK_CANDIDATES_APPLY=1 with DRY_RUN=0');
    process.exit(2);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('DATABASE_URL (or APP_DATABASE_URL) is required for apply mode');
    process.exit(2);
  }

  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    max: 2,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await upsertPlan(client, plan);
    await client.query('COMMIT');
    console.log(`Applied ${plan.candidates.length} landscape candidates for ${lane}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  return plan;
}

async function main(): Promise<void> {
  const laneArg = (arg('lane') ?? (hasFlag('--all') ? 'all' : undefined)) as LaneArg | undefined;
  if (!laneArg) {
    console.error(
      'Usage: load-bulk-candidates-to-supabase.ts --lane=dc-sites|greenbook|hbcu [--fixture=path] [--fetch] | --all',
    );
    process.exit(2);
  }

  const fixture = arg('fixture');
  const fetch = hasFlag('--fetch');
  const lanes: BulkLane[] =
    laneArg === 'all'
      ? (['dc-sites', 'hbcu', 'greenbook'] as const)
      : [laneArg as BulkLane];

  let totalCandidates = 0;
  for (const lane of lanes) {
    const plan = await loadLane(lane, { fetch, ...(fixture ? { fixture } : {}) });
    totalCandidates += plan.candidates.length;
  }
  console.log(`Total candidates planned/applied: ${totalCandidates}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
