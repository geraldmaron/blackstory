/**
 * Recompute derived research coverage from published claims and summaries.
 * Reconcile both release projections and search facets with the domain calculation.
 * Default is dry-run; writes require DRY_RUN=0 and COVERAGE_RESYNC_APPLY=1.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeReleaseResearchCoverage, type ReleaseResearchCoverage } from '@repo/domain';
import pg from 'pg';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import { toClaimProjections } from './lib/notability-basis-resync.ts';
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
  readonly summary: string | null;
  readonly projection: Record<string, unknown>;
  /** `null` when the entity has no search_index row at all — nothing to reconcile. */
  readonly facet_coverage: string | null;
};

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
    `SELECT e.entity_id, e.release_id, e.display_name, e.summary, e.projection,
            s.facets->>'researchCoverage' AS facet_coverage
       FROM published.release_entities e
       JOIN published.active_release a ON a.release_id = e.release_id
       LEFT JOIN published.search_index s ON s.entity_id = e.entity_id
      ORDER BY e.entity_id`,
  );
  console.log(`Entities in the active release: ${res.rows.length}`);

  const changes: Change[] = [];
  // Compare each denormalized copy independently with the recomputed value.
  const facetFixes: { entityId: string; before: string; after: ReleaseResearchCoverage }[] = [];
  for (const row of res.rows) {
    // Public readers consume projection claims.
    const claims = toClaimProjections(row.projection?.claims);
    const before = String(row.projection?.researchCoverage ?? '');
    // Summary content participates in the coverage grade.
    const after = computeReleaseResearchCoverage(claims, row.summary ?? '');
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
      claimCount: claims.length,
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
        `UPDATE published.release_entities
            SET projection = jsonb_set(projection, '{researchCoverage}', to_jsonb($1::text), true)
          WHERE entity_id = $2`,
        [change.after, change.entityId],
      );
    }
    for (const fix of facetFixes) {
      await client.query(
        `UPDATE published.search_index
            SET facets = jsonb_set(facets, '{researchCoverage}', to_jsonb($1::text), true)
          WHERE entity_id = $2`,
        [fix.after, fix.entityId],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: ${changes.length} projection value(s), ${facetFixes.length} search_index facet(s).`,
    );
    remindToRepublishCatalogArtifacts(changes.length + facetFixes.length);
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
