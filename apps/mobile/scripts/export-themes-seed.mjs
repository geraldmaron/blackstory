/**
 * Export theme-impact catalog + researched packet views into mobile JSON.
 * Run from repo root via the single entrypoint:
 *   node --conditions=development --import tsx apps/mobile/scripts/generate-seeds.mjs themes
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { themeImpactPacketToView } from '@repo/domain/statistics';
import { normalizePgConnectionString } from '../../../packages/ops-data/scripts/lib/pg-connection.ts';

const here = dirname(fileURLToPath(import.meta.url));
// `pg` is a dependency of ops-data, not the mobile app — resolve it from there.
const requireFromOpsData = createRequire(
  resolve(here, '../../../packages/ops-data/package.json'),
);
const pg = requireFromOpsData('pg');
const outPath = resolve(here, '../src/features/themes/catalog-seed.json');

/** Mirror of web `THEME_IMPACT_CATALOG` (browse title/lede not in domain). */
const THEME_IMPACT_CATALOG = [
  {
    id: 'redlining',
    title: 'Housing segregation & redlining',
    priority: 'P0',
    lede:
      'Walk from a named beach in 1919 through federal maps, county instruments, and a South Side district you can still name. Metro readings where the record is densest; national wealth for scale.',
    available: true,
  },
  {
    id: 'drug_policy_state',
    title: 'Drug policy, sentencing & enforcement',
    priority: 'P0',
    lede:
      'Federal statutes read beside jail, sentencing, and imprisonment instruments, without speculative intelligence-market claims.',
    available: true,
  },
  {
    id: 'urban_renewal',
    title: 'Urban renewal',
    priority: 'P1',
    lede:
      'Federal project records, reported family and housing fields, and later county demographics, with missing project fields kept unknown.',
    available: true,
  },
  {
    id: 'mass_incarceration',
    title: 'Mass incarceration',
    priority: 'P1',
    lede:
      'National BJS-published adult imprisonment rates across a decade, then a distinct ACS-denominator state Black-White disparity cross-section for 2022-2023.',
    available: true,
  },
  {
    id: 'environmental_racism',
    title: 'Environmental justice & unequal burden',
    priority: 'P1',
    lede:
      'An Illinois county test using ACS, CDC EJI, and EPA TRI data, including the mixed results that challenge a simple facility-count story.',
    available: true,
  },
  {
    id: 'school_segregation',
    title: 'School segregation & opportunity',
    priority: 'P1',
    lede:
      'How residential segregation feeds school opportunity. Metro attainment sits beside national BA+ shares and the desegregation record; district discipline series stay unloaded.',
    available: true,
  },
  {
    id: 'voting_rights',
    title: 'Voting rights & political exclusion',
    priority: 'P1',
    lede:
      'Franchise rules from Reconstruction through the Voting Rights Act, with Census CPS A-1 national turnout for presidential years 1992-2020. State policy indexes remain cite-first.',
    available: true,
  },
];

// Source of truth is the active Supabase release, not a committed fixture. Reading
// the release is what keeps unreleased packets (status 'review') out of the app —
// the old fixture path shipped tip_drug_policy_q6_il_spine, which is not released.
const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL (or APP_DATABASE_URL) is required — source apps/web/.env.local');
}
const conn = normalizePgConnectionString(databaseUrl);
const client = new pg.Client({
  connectionString: conn.connectionString,
  ...(conn.ssl ? { ssl: conn.ssl } : {}),
});
await client.connect();
const { rows: released } = await client.query(`
  SELECT release_id, packet_id, payload
  FROM bb_public.release_theme_impact_packets
  WHERE release_id = (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
  ORDER BY packet_id
`);
await client.end();

if (released.length === 0) {
  throw new Error('active release contains no theme-impact packets — refusing to write an empty seed');
}

const releaseId = released[0].release_id;
const packets = released.map((row) =>
  themeImpactPacketToView(row.payload, { dataSource: 'release' }),
);

const snapshot = {
  version: `theme-impact-${releaseId}`,
  generatedAt: new Date().toISOString(),
  source: 'supabase-active-release',
  releaseId,
  releaseLabel: 'Published release',
  themes: THEME_IMPACT_CATALOG,
  packets,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${outPath} (${THEME_IMPACT_CATALOG.length} themes, ${packets.length} packets)`,
);
