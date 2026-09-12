/**
 * repo-rm2y — the standing resync for the DERIVED `notabilityBasis` / `notabilityLabels` fields.
 *
 * The bead: nothing resynchronizes a record's derived fields when its summary or claim set is
 * edited in place, so a hand-fix pass leaves the reasons a record is in the catalog describing a
 * version of the record that no longer exists. `fix-civil-rights-leaders-uncorroborated.ts`
 * rewrote three records' summary, claims and claimIds with hand-written claim ids and recomputed
 * no derived field; the basis records it left behind still point at claim ids nobody carries, and
 * their notes are those records' OLD summaries with the literal string "Documented site " on the
 * front of a person.
 *
 * WHY A CORRECTION PASS RATHER THAN A REPUBLISH: `publish-release-entities-incremental.ts`
 * re-derives an entity from its `bb_research.landscape_candidates` row and runs the full publish
 * gate, so routing this through it would both skip rows the gate rejects and REPLACE the curated
 * basis records that earlier passes hand-authored (repo-z1uk). This pass recomputes derived fields
 * from the claims already published, merging rather than replacing. Same shape as
 * `resync-research-coverage.ts`, which does the third derived field.
 *
 * The rule — the ratified merge, plus the two provable staleness tests — lives in
 * `lib/notability-basis-resync.ts` and is shared with `apply-notability-rubric-ruling.ts`, so the
 * one-off ruling pass and this standing resync cannot disagree about what the rule is.
 *
 * Every copy of the value moves together. A released row keeps the basis in the projection, in
 * `taxonomy.notabilityLabels`, and in `search_index.facets`; the ruling pass wrote the first two
 * and not the third, which is part of why 18 rows diverged. See the library header for what is
 * written, and for why `bb_canonical.entities.notability_basis` deliberately is not.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 NOTABILITY_BASIS_RESYNC_APPLY=1
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/resync-notability-basis.ts [--ids=ent_a,ent_b] [--release=rel_...]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  applyNotabilityBasisResync,
  formatNotabilityBasisResyncPlan,
  loadNotabilityBasisResyncRows,
  planNotabilityBasisResync,
} from './lib/notability-basis-resync.ts';
import { resolveActiveReleaseId } from './lib/projection-divergence.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const REPORT_DIR = join(REPO_ROOT, '.cache/notability-basis-resync');

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.NOTABILITY_BASIS_RESYNC_APPLY === '1';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const RELEASE = flag('release', '');
const IDS = flag('ids', '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  try {
    const releaseId = RELEASE.length > 0 ? RELEASE : await resolveActiveReleaseId(pool);
    const rows = await loadNotabilityBasisResyncRows(
      pool,
      releaseId,
      IDS.length > 0 ? IDS : undefined,
    );
    const plan = planNotabilityBasisResync(rows);

    console.log('=== Resync notabilityBasis / notabilityLabels ===');
    console.log(`Release: ${releaseId}`);
    if (IDS.length > 0) console.log(`Scoped to ${IDS.length} requested id(s).`);
    for (const line of formatNotabilityBasisResyncPlan(plan)) console.log(line);

    if (plan.changes.length > 0) {
      console.log('\nPer-record changes:');
      for (const change of plan.changes) {
        console.log(`  ${change.entityId} — ${change.displayName}`);
        console.log(`    write targets: ${change.writeTargets.join(', ')}`);
        for (const dropped of change.droppedDangling) {
          console.log(
            `    DROP [${dropped.criterion}] evidence=${JSON.stringify(dropped.evidenceIds)}`,
          );
          console.log(`         ${JSON.stringify(dropped.note)}`);
        }
        for (const refresh of change.refreshedNotes) {
          console.log(`    NOTE [${refresh.criterion}]`);
          console.log(`         before ${JSON.stringify(refresh.before)}`);
          console.log(`         after  ${JSON.stringify(refresh.after)}`);
        }
        console.log(
          `    basis ${change.basisBefore.length} -> ${change.basisAfter.length} | labels ${change.labelsBefore.length} -> ${change.labelsAfter.length}`,
        );
      }
    }

    const generatedAt = new Date().toISOString();
    mkdirSync(REPORT_DIR, { recursive: true });
    const reportPath = join(
      REPORT_DIR,
      `notability-basis-resync-${generatedAt.replace(/[:.]/gu, '-')}.json`,
    );
    writeFileSync(
      reportPath,
      `${JSON.stringify({ generatedAt, releaseId, dryRun: DRY_RUN || !APPLY, ...plan }, null, 2)}\n`,
    );
    console.log(`\nReport written to ${reportPath}`);

    if (plan.refusesToWrite) {
      console.error('\nRefusing to write. See the guard output above.');
      process.exitCode = 1;
      return;
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 NOTABILITY_BASIS_RESYNC_APPLY=1 to apply.',
      );
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await applyNotabilityBasisResync(client, plan, releaseId);
      await client.query('COMMIT');
      console.log(
        `\nApplied: ${result.projectionRows} release_entities row(s), ${result.searchIndexRows} search_index row(s).`,
      );
      remindToRepublishCatalogArtifacts(result.projectionRows);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
