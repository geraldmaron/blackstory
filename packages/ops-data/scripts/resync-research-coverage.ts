/**
 * repo-z1pw — corpus-wide resync of the DERIVED `researchCoverage` field after
 * `computeReleaseResearchCoverage` changed from counting claims to counting distinct source
 * documents.
 *
 * Why a correction pass rather than a republish: `publish-release-entities-incremental.ts`
 * re-derives an entity from its `bb_research.landscape_candidates` row and runs the full publish
 * gate, and the depth gate ('template_only', added 2026-08-06) now REJECTS exactly the rows whose
 * coverage is wrong. Routing the fix through that path would skip every record it needs to
 * correct. This pass recomputes one derived field from the claims already published, touching
 * nothing else — the same shape as `fix-civil-rights-leaders-derived-fields.ts`, widened from
 * four hand-listed ids to the active release.
 *
 * `researchCoverage` is denormalized in two places, and they must move together or search facets
 * disagree with the record page:
 *   - bb_public.release_entities.projection->>'researchCoverage'
 *   - bb_public.search_index.facets->>'researchCoverage'
 *
 * Coverage is recomputed with the real function from @repo/domain rather than restated here, so
 * this cannot drift from what the next full release build would produce.
 *
 * Why it matters: 'minimal' plus an empty historicalContext is what makes the record page print
 * its REGISTRY LISTING notice (apps/web `isThinRecord`). While coverage counted claims, the
 * nrhp-black-heritage lane's two claims — a listing fact and a significance fact carved out of
 * ONE index row, both citing that row's own URL — graded 'partial', so 2,436 records built from a
 * single spreadsheet line suppressed the notice and read to a visitor as researched history.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 COVERAGE_RESYNC_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/resync-research-coverage.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeReleaseResearchCoverage,
  type ReleaseClaimProjection,
  type ReleaseResearchCoverage,
} from '@repo/domain';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/coverage-resync');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.COVERAGE_RESYNC_APPLY === '1';

type Row = {
  readonly entity_id: string;
  readonly release_id: string;
  readonly display_name: string;
  readonly claims: unknown;
  readonly projection: Record<string, unknown>;
  /** `null` when the entity has no search_index row at all — nothing to reconcile. */
  readonly facet_coverage: string | null;
};

/**
 * The claim fields `computeReleaseResearchCoverage` reads, recovered from the published JSONB.
 * A claim missing `citationSource` normalizes to '' (uncited) rather than being dropped, so the
 * count this pass produces matches what the builder would produce from the same claim set.
 */
function toClaimProjections(claims: unknown): ReleaseClaimProjection[] {
  if (!Array.isArray(claims)) return [];
  return claims.map((raw, index) => {
    const claim = (raw ?? {}) as Record<string, unknown>;
    const href = claim.citationHref;
    return {
      id: typeof claim.id === 'string' ? claim.id : `claim_${index}`,
      predicate: typeof claim.predicate === 'string' ? claim.predicate : '',
      object: typeof claim.object === 'string' ? claim.object : '',
      confidenceLevel:
        claim.confidenceLevel === 'high' || claim.confidenceLevel === 'medium'
          ? claim.confidenceLevel
          : 'low',
      citationSource: typeof claim.citationSource === 'string' ? claim.citationSource : '',
      ...(typeof href === 'string' && href.length > 0 ? { citationHref: href } : {}),
      citationLabel: typeof claim.citationLabel === 'string' ? claim.citationLabel : '',
    };
  });
}

type Change = {
  readonly entityId: string;
  readonly displayName: string;
  readonly before: string;
  readonly after: ReleaseResearchCoverage;
  readonly claimCount: number;
  readonly hasContext: boolean;
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const res = await pool.query<Row>(
    `SELECT e.entity_id, e.release_id, e.display_name, e.claims, e.projection,
            s.facets->>'researchCoverage' AS facet_coverage
       FROM bb_public.release_entities e
       JOIN bb_public.active_release a ON a.release_id = e.release_id
       LEFT JOIN bb_public.search_index s ON s.entity_id = e.entity_id
      ORDER BY e.entity_id`,
  );
  console.log(`Entities in the active release: ${res.rows.length}`);

  const changes: Change[] = [];
  // The two denormalized copies are reconciled INDEPENDENTLY against the recomputed value.
  // Gating the search_index write on "the projection changed" (the first cut of this script)
  // leaves behind facets that were already stale before this pass ran — 671 of them on the
  // 2026-08-10 run, every one a facet sitting BELOW its own projection, the repo-rm2y symptom
  // where an earlier in-place correction updated one copy and not the other. The recomputed
  // value is authoritative for both, so each copy is compared to it on its own.
  const facetFixes: { entityId: string; before: string; after: ReleaseResearchCoverage }[] = [];
  for (const row of res.rows) {
    const before = String(row.projection?.researchCoverage ?? '');
    const after = computeReleaseResearchCoverage(toClaimProjections(row.claims));
    const facetBefore = row.facet_coverage;
    if (facetBefore !== null && facetBefore !== after) {
      facetFixes.push({
        entityId: row.entity_id,
        before: facetBefore.length > 0 ? facetBefore : '(unset)',
        after,
      });
    }
    if (before === after) continue;
    const context = String(row.projection?.historicalContext ?? '').trim();
    changes.push({
      entityId: row.entity_id,
      displayName: row.display_name,
      before: before.length > 0 ? before : '(unset)',
      after,
      claimCount: Array.isArray(row.claims) ? row.claims.length : 0,
      hasContext: context.length > 0,
    });
  }

  const transitions = new Map<string, number>();
  for (const change of changes) {
    const key = `${change.before} -> ${change.after}`;
    transitions.set(key, (transitions.get(key) ?? 0) + 1);
  }
  console.log(`\nCoverage changes: ${changes.length}`);
  console.table([...transitions.entries()].map(([transition, count]) => ({ transition, count })));

  // The reader-visible consequence, reported separately because it is the point of the fix:
  // apps/web's isThinRecord() requires 'minimal' AND no historicalContext before it prints the
  // REGISTRY LISTING notice. A demotion on a record that HAS narrative context changes search
  // facets only — it must not be reported as "a notice now appears".
  const newlyDisclosed = changes.filter((c) => c.after === 'minimal' && !c.hasContext);
  const facetOnly = changes.filter((c) => c.after === 'minimal' && c.hasContext);
  console.log(`Records that will now show the REGISTRY LISTING notice: ${newlyDisclosed.length}`);
  console.log(`Demoted but narrated (facets only, no notice — repo-ol8v): ${facetOnly.length}`);
  console.log(`\nsearch_index facets to reconcile: ${facetFixes.length}`);
  console.log(
    `  ...of which were already stale before this pass: ${
      facetFixes.filter((fix) => !changes.some((change) => change.entityId === fix.entityId)).length
    }`,
  );

  const generatedAt = new Date().toISOString();
  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, `coverage-resync-${generatedAt.replace(/[:.]/gu, '-')}.json`);
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt,
        dryRun: DRY_RUN || !APPLY,
        scanned: res.rows.length,
        changed: changes.length,
        newlyDisclosed: newlyDisclosed.length,
        facetOnly: facetOnly.length,
        transitions: Object.fromEntries(transitions),
        changes,
        facetFixes,
      },
      null,
      2,
    ),
  );
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 COVERAGE_RESYNC_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const change of changes) {
      await client.query(
        `UPDATE bb_public.release_entities
            SET projection = jsonb_set(projection, '{researchCoverage}', to_jsonb($1::text), true)
          WHERE entity_id = $2`,
        [change.after, change.entityId],
      );
    }
    for (const fix of facetFixes) {
      await client.query(
        `UPDATE bb_public.search_index
            SET facets = jsonb_set(facets, '{researchCoverage}', to_jsonb($1::text), true)
          WHERE entity_id = $2`,
        [fix.after, fix.entityId],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: ${changes.length} projection value(s), ${facetFixes.length} search_index facet(s).`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
