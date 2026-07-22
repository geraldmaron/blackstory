/**
 * Read-only audit: `bb_canonical.entities` vs active `bb_public.release_entities`.
 * Classifies each canonical row for promote eligibility using the same gates as
 * auto-promote / constitution (person privacy, location, claims, notability).
 * Emits a weed table with counts and writes JSON under `.cache/ledger-audit/`.
 *
 * Does not write bb_public or activate releases.
 *
 * Usage (from repo root):
 *   DATABASE_URL=… DATABASE_SSL=true node --conditions development --import tsx \
 *     packages/firebase/scripts/audit-canonical-public-readiness.ts
 *
 * Optional:
 *   --write-list=<reason>   dump entity ids for one skip bucket (e.g. person_privacy_hold)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpsPostgresPool } from '../../data-access/src/postgres/pool.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const reportDir = join(repoRoot, '.cache/ledger-audit');

type KindRow = { readonly kind: string; readonly n: number };
type WeedRow = { readonly skip_reason: string; readonly n: number };
type EntityRow = { readonly id: string; readonly display_name: string; readonly kind: string };

const AUDIT_SQL = `
WITH active AS (
  SELECT release_id FROM bb_public.active_release LIMIT 1
),
entity_stats AS (
  SELECT
    e.id,
    e.display_name,
    e.kind,
    e.living_status,
    jsonb_array_length(COALESCE(e.notability_basis, '[]'::jsonb)) AS notability_count,
    (SELECT COUNT(*)::int FROM bb_canonical.claims c WHERE c.entity_id = e.id) AS claim_count,
    (SELECT COUNT(*)::int FROM bb_canonical.entity_locations el
       WHERE el.entity_id = e.id AND el.lat IS NOT NULL AND el.lng IS NOT NULL) AS loc_count,
    EXISTS (
      SELECT 1 FROM bb_public.release_entities re, active a
      WHERE re.release_id = a.release_id AND re.entity_id = e.id
    ) AS in_public
  FROM bb_canonical.entities e
),
classified AS (
  SELECT
    id,
    display_name,
    kind,
    CASE
      WHEN in_public THEN 'already_in_public'
      WHEN kind = 'person' AND living_status IN ('living', 'unknown') THEN 'person_privacy_hold'
      WHEN loc_count = 0 THEN 'no_canonical_location'
      WHEN claim_count = 0 THEN 'no_canonical_claims'
      WHEN notability_count = 0 THEN 'no_notability_basis'
      ELSE 'promote_eligible'
    END AS skip_reason
  FROM entity_stats
)
SELECT skip_reason, COUNT(*)::int AS n
FROM classified
GROUP BY skip_reason
ORDER BY n DESC;
`;

const SUMMARY_SQL = `
WITH active AS (SELECT release_id FROM bb_public.active_release LIMIT 1),
pub AS (
  SELECT entity_id FROM bb_public.release_entities re, active a WHERE re.release_id = a.release_id
),
canon AS (SELECT id FROM bb_canonical.entities)
SELECT
  (SELECT COUNT(*)::int FROM bb_canonical.entities) AS canonical_total,
  (SELECT COUNT(*)::int FROM pub) AS public_active_total,
  (SELECT COUNT(*)::int FROM canon c WHERE c.id NOT IN (SELECT entity_id FROM pub)) AS canonical_not_in_public,
  (SELECT COUNT(*)::int FROM pub p WHERE p.entity_id NOT IN (SELECT id FROM canon)) AS public_not_in_canonical,
  (SELECT COUNT(*)::int FROM bb_canonical.claims) AS canonical_claim_rows,
  (SELECT COUNT(*)::int FROM bb_canonical.entity_locations) AS canonical_location_rows;
`;

const EMPTY_CLAIMS_PUBLIC_SQL = `
WITH active AS (SELECT release_id FROM bb_public.active_release LIMIT 1)
SELECT re.entity_id, re.display_name, re.kind
FROM bb_public.release_entities re, active a
WHERE re.release_id = a.release_id
  AND (re.claims IS NULL OR jsonb_typeof(re.claims) <> 'array' OR jsonb_array_length(re.claims) = 0)
ORDER BY re.kind, re.display_name;
`;

const KINDS_CANONICAL_SQL = `
SELECT kind, COUNT(*)::int AS n FROM bb_canonical.entities GROUP BY kind ORDER BY n DESC;
`;

const PUBLIC_ONLY_KINDS_SQL = `
WITH active AS (SELECT release_id FROM bb_public.active_release LIMIT 1)
SELECT re.kind, COUNT(*)::int AS n
FROM bb_public.release_entities re, active a
WHERE re.release_id = a.release_id
  AND re.entity_id NOT IN (SELECT id FROM bb_canonical.entities)
GROUP BY re.kind ORDER BY n DESC;
`;

function readWriteListArg(): string | undefined {
  const prefix = '--write-list=';
  const hit = process.argv.find((entry) => entry.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function printWeedTable(rows: readonly WeedRow[]): void {
  console.log('\n## Weed table (canonical → public readiness)\n');
  console.log('| Skip reason | Count |');
  console.log('|-------------|------:|');
  for (const row of rows) {
    console.log(`| ${row.skip_reason} | ${row.n} |`);
  }
}

async function main(): Promise<void> {
  const pool = getOpsPostgresPool({ ...process.env, DATABASE_SSL: 'true' });
  const writeList = readWriteListArg();

  try {
    const [summaryRes, weedRes, kindsRes, publicOnlyRes, emptyClaimsRes] = await Promise.all([
      pool.query(SUMMARY_SQL),
      pool.query<WeedRow>(AUDIT_SQL),
      pool.query<KindRow>(KINDS_CANONICAL_SQL),
      pool.query<KindRow>(PUBLIC_ONLY_KINDS_SQL),
      pool.query<EntityRow>(EMPTY_CLAIMS_PUBLIC_SQL),
    ]);

    const summary = summaryRes.rows[0] as {
      canonical_total: number;
      public_active_total: number;
      canonical_not_in_public: number;
      public_not_in_canonical: number;
      canonical_claim_rows: number;
      canonical_location_rows: number;
    };

    const weed = weedRes.rows;
    const promoteEligible =
      weed.find((row) => row.skip_reason === 'promote_eligible')?.n ?? 0;

    printWeedTable(weed);

    console.log('\n## Counts\n');
    console.log(`| Metric | Before audit |`);
    console.log(`|--------|-------------:|`);
    console.log(`| bb_canonical.entities | ${summary.canonical_total} |`);
    console.log(`| bb_public.release_entities (active) | ${summary.public_active_total} |`);
    console.log(`| Canonical not in public | ${summary.canonical_not_in_public} |`);
    console.log(`| Public not in canonical (fixture drift) | ${summary.public_not_in_canonical} |`);
    console.log(`| bb_canonical.claims rows | ${summary.canonical_claim_rows} |`);
    console.log(`| bb_canonical.entity_locations rows | ${summary.canonical_location_rows} |`);
    console.log(`| Promote-eligible (net-new) | ${promoteEligible} |`);

    console.log('\n## Canonical kind breakdown\n');
    for (const row of kindsRes.rows) {
      console.log(`  ${row.kind}: ${row.n}`);
    }

    if (publicOnlyRes.rows.length > 0) {
      console.log('\n## Public-only (not in canonical ledger)\n');
      for (const row of publicOnlyRes.rows) {
        console.log(`  ${row.kind}: ${row.n}`);
      }
    }

    if (emptyClaimsRes.rows.length > 0) {
      console.log('\n## Active public rows with empty claims\n');
      for (const row of emptyClaimsRes.rows) {
        console.log(`  ${row.entity_id} (${row.kind}) — ${row.display_name}`);
      }
    }

    mkdirSync(reportDir, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 10);
    const reportPath = join(reportDir, `readiness-${stamp}.json`);
    const report = {
      generatedAt: new Date().toISOString(),
      summary,
      weed,
      canonicalKinds: kindsRes.rows,
      publicOnlyKinds: publicOnlyRes.rows,
      publicEmptyClaims: emptyClaimsRes.rows,
      promoteEligible,
      gates: {
        personRule:
          'kind=person blocked unless living_status=deceased AND already published with privacy cleared',
        claimConfidenceFloor: 0.75,
        requiresCanonicalClaims: true,
        requiresCanonicalLocation: true,
        requiresNotabilityBasis: true,
      },
      promoteCommands: [
        '# No net-new canonical rows eligible — skip publish-national-catalog until ledger backfill.',
        '# When eligible rows exist:',
        'DRY_RUN=1 APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts',
        'APP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts',
      ],
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`\nReport: ${reportPath}`);

    if (writeList) {
      const listSql = `
WITH active AS (SELECT release_id FROM bb_public.active_release LIMIT 1),
entity_stats AS (
  SELECT e.id, e.display_name, e.kind, e.living_status,
    jsonb_array_length(COALESCE(e.notability_basis, '[]'::jsonb)) AS notability_count,
    (SELECT COUNT(*)::int FROM bb_canonical.claims c WHERE c.entity_id = e.id) AS claim_count,
    (SELECT COUNT(*)::int FROM bb_canonical.entity_locations el
       WHERE el.entity_id = e.id AND el.lat IS NOT NULL AND el.lng IS NOT NULL) AS loc_count,
    EXISTS (SELECT 1 FROM bb_public.release_entities re, active a
      WHERE re.release_id = a.release_id AND re.entity_id = e.id) AS in_public
  FROM bb_canonical.entities e
)
SELECT id, display_name, kind FROM entity_stats
WHERE CASE
  WHEN in_public THEN 'already_in_public'
  WHEN kind = 'person' AND living_status IN ('living', 'unknown') THEN 'person_privacy_hold'
  WHEN loc_count = 0 THEN 'no_canonical_location'
  WHEN claim_count = 0 THEN 'no_canonical_claims'
  WHEN notability_count = 0 THEN 'no_notability_basis'
  ELSE 'promote_eligible'
END = $1
ORDER BY kind, display_name;
`;
      const listRes = await pool.query<EntityRow>(listSql, [writeList]);
      const listPath = join(reportDir, `list-${writeList}-${stamp}.json`);
      writeFileSync(listPath, `${JSON.stringify(listRes.rows, null, 2)}\n`);
      console.log(`List (${writeList}, n=${listRes.rows.length}): ${listPath}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
