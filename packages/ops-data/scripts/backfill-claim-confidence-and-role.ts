/**
 * Re-derive `confidenceLevel` and stamp `claimRole` on every published claim.
 *
 * Two defects in already-published data, both fixed at the source in `incremental-publish.ts`
 * but stranded on the 11,555 claims already in `bb_public`:
 *
 * - **repo-hqwt9.** Claim confidence came from a binary `sourceTier` check that never emitted
 *   `low`: 10,572 claims `high`, 983 `medium`, none `low`. A three-segment reader-facing meter
 *   was being rendered from a two-value vocabulary, and 2,049 claims cited Wikipedia at `high`
 *   when `claim-corroborate` puts a Wikipedia claim at `low`.
 * - **repo-6qjv0.** Whether a claim is the record's own index row was inferred from its
 *   predicate. The publisher now states it in `claimRole`; this stamps the same answer onto the
 *   existing rows so the inference can eventually come out.
 *
 * Both derivations are imported, never restated. `confidenceLevelForSource` classifies the
 * citation URL, and `claimRoleForPredicate` is the domain's own bridge rule. Restating either in
 * SQL is exactly how the record tier ended up with three copies that could drift.
 *
 * `release_entities` keeps claims in two places — the `claims` column and `projection->'claims'`
 * — and they are byte-identical across all 4,167 published rows today. This writes both.
 *
 * Run the facet backfill and republish the catalog artifacts after this: the claim levels feed
 * `search_index.facets.confidenceTier`, which `/records` reads.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-claim-confidence-and-role.ts
 *
 * Apply:
 *   DRY_RUN=0 BACKFILL_CLAIM_CONFIDENCE_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/backfill-claim-confidence-and-role.ts
 */
import pg from 'pg';
import { claimRoleForPredicate } from '@repo/domain/publication/release-builder';
import { confidenceLevelForSource } from './lib/confidence.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_CLAIM_CONFIDENCE_APPLY === '1';

type Claim = Record<string, unknown>;

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** The claim as it should be published, or the same object when nothing changes. */
function rederive(claim: Claim): Claim {
  const href = typeof claim.citationHref === 'string' ? claim.citationHref : undefined;
  const predicate = typeof claim.predicate === 'string' ? claim.predicate : undefined;
  const level = confidenceLevelForSource(href);
  const role =
    typeof claim.claimRole === 'string' && claim.claimRole.trim().length > 0
      ? claim.claimRole
      : claimRoleForPredicate(predicate);
  if (claim.confidenceLevel === level && claim.claimRole === role) return claim;
  return { ...claim, confidenceLevel: level, claimRole: role };
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    const { rows } = await client.query<{
      entity_id: string;
      release_id: string;
      claims: Claim[] | null;
    }>(
      `SELECT re.entity_id, re.release_id,
              CASE WHEN jsonb_typeof(re.projection->'claims') = 'array'
                   THEN re.projection->'claims' ELSE '[]'::jsonb END AS claims
         FROM bb_public.release_entities re
         JOIN bb_public.v_active_release_id r ON r.release_id = re.release_id`,
    );

    const changed: { releaseId: string; entityId: string; claims: Claim[] }[] = [];
    const levelCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};
    let claimsSeen = 0;
    let claimsChanged = 0;

    for (const row of rows) {
      const claims = row.claims ?? [];
      const next = claims.map(rederive);
      claimsSeen += claims.length;
      for (const [index, claim] of next.entries()) {
        const level = String(claim.confidenceLevel);
        const role = String(claim.claimRole);
        levelCounts[level] = (levelCounts[level] ?? 0) + 1;
        roleCounts[role] = (roleCounts[role] ?? 0) + 1;
        if (claim !== claims[index]) claimsChanged += 1;
      }
      if (next.some((claim, index) => claim !== claims[index])) {
        changed.push({ releaseId: row.release_id, entityId: row.entity_id, claims: next });
      }
    }

    console.log(`records: ${rows.length}, claims: ${claimsSeen}`);
    console.log(`claims rewritten: ${claimsChanged}, records touched: ${changed.length}`);
    console.log('resulting confidenceLevel:', levelCounts);
    console.log('resulting claimRole:', roleCounts);

    if (changed.length === 0) {
      console.log('nothing to do');
      return;
    }
    if (DRY_RUN || !APPLY) {
      console.log('dry run only (set DRY_RUN=0 BACKFILL_CLAIM_CONFIDENCE_APPLY=1 to write)');
      return;
    }

    // One transaction: `claims` and `projection->'claims'` are identical across every published
    // row, and a partial write would leave the two disagreeing about the same record.
    await client.query('BEGIN');
    try {
      for (const row of changed) {
        await client.query(
          `UPDATE bb_public.release_entities
              SET claims = $3::jsonb,
                  projection = jsonb_set(projection, '{claims}', $3::jsonb, true)
            WHERE release_id = $1 AND entity_id = $2`,
          [row.releaseId, row.entityId, JSON.stringify(row.claims)],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`updated ${changed.length} records`);
    console.log(
      'now run backfill-search-facets-confidence.ts, then publish-release-catalog-artifacts.ts',
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
