/**
 * repo-teb1z — applies the notability rubric ruling to the published catalog.
 *
 * The ruling is docs/methodology/notability-rubric.md, measured against
 * rel_20260723_authority_net_001 on 2026-09-09: `documented_site` answered for 63% of every basis
 * record in the catalog, and every criterion whose ratified text named several kinds was in use on
 * exactly one kind, usually not one its text described. Twenty-one PLACES were filed as judicial
 * precedents and four actual court cases were.
 *
 * This script does not decide anything. It recomputes each row's basis with
 * `buildReleaseNotabilityBasis` — the same function the publisher uses, so there is no second copy
 * of the inference here — and merges the result onto what is published.
 *
 * MERGE, NEVER REPLACE, and this is the part that matters.
 *
 * A record's published basis is not always derived from its claims. Earlier passes hand-authored
 * criteria (fix-civil-rights-leaders-notability-basis.ts, fix-person-notability-and-stubs.ts,
 * packages/domain/src/seed-campaigns/records.ts), and nothing in those records' claim text carries
 * the keyword that would reproduce them. A straight recompute — which is what a first draft of
 * this script did — took `first_to_do_x` off Carter G. Woodson and Hattie McDaniel,
 * `major_honor_or_hall_of_fame` off Denzel Washington, Stevie Wonder and Katherine Johnson, and
 * `movement_significance` off Fred Shuttlesworth and Bayard Rustin. Twenty records in the sample
 * alone, all of them curated work, all of them silently replaced by the fallback.
 *
 * So: every non-fallback criterion a record already publishes is KEPT. Only the `documented_site`
 * records are up for replacement. The pass can add a criterion and can drop a metadata basis
 * record; it cannot take away a reason a person put there.
 *
 * Measured effect on the active release, 2026-09-09:
 *   basis records            10,427 -> 6,155      (M1: metadata predicates stop being reasons)
 *   documented_site           6,589 -> 1,767      the residual repo-o6k0c retires it against
 *   court_precedent              46 -> 139        enacted_law 0 -> 135
 *   movement_significance        30 -> 106        black_press_or_archive 0 -> 52
 *   community_anchor              4 -> 49         elected_or_appointed_office 0 -> 36
 *   documented_contribution      19 -> 35         documented_racial_killing 0 -> 11
 *   first_to_do_x / major_honor / landmark / racial_terror: unchanged or up, never down
 *   records left with no basis at all: 1, sundown_crescent_springs_kentucky, already known
 *
 * NOT IN SCOPE. Retiring `documented_site` as a fallback is repo-o6k0c and goes last, against the
 * residual this pass leaves rather than an estimated one.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-notability-rubric-ruling.ts
 *
 * Apply:
 *   DRY_RUN=0 APPLY_NOTABILITY_RULING=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-notability-rubric-ruling.ts
 */
import pg from 'pg';
import {
  buildReleaseNotabilityBasis,
  NOTABILITY_RUBRIC,
  type NotabilityBasisRecord,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.APPLY_NOTABILITY_RULING === '1';
const FALLBACK_CRITERION = 'documented_site';

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

type Row = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly summary: string | null;
  readonly claims: readonly ReleaseClaimProjection[] | null;
  readonly projection: { notabilityBasis?: readonly NotabilityBasisRecord[] } | null;
  readonly taxonomy: Record<string, unknown> | null;
};

function encode(records: readonly NotabilityBasisRecord[]): string {
  return JSON.stringify(
    records.map((r) => `${r.criterion}|${r.note}|${[...r.evidenceIds].sort().join(',')}`).sort(),
  );
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const active = await client.query<{ release_id: string }>(
      `SELECT release_id FROM bb_public.v_active_release_id`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('No active release');

    const { rows } = await client.query<Row>(
      `SELECT entity_id, display_name, kind, summary, claims, projection, taxonomy
         FROM bb_public.release_entities WHERE release_id = $1 ORDER BY entity_id`,
      [releaseId],
    );

    type Change = { readonly row: Row; readonly after: readonly NotabilityBasisRecord[] };
    const changes: Change[] = [];
    const wouldEmpty: string[] = [];
    const before = new Map<string, number>();
    const after = new Map<string, number>();
    let unchanged = 0;

    for (const row of rows) {
      const published = row.projection?.notabilityBasis ?? [];
      for (const record of published) {
        before.set(record.criterion, (before.get(record.criterion) ?? 0) + 1);
      }
      const claims = Array.isArray(row.claims) ? row.claims : [];
      if (claims.length === 0) {
        for (const record of published) {
          after.set(record.criterion, (after.get(record.criterion) ?? 0) + 1);
        }
        continue;
      }

      // Only `kind`, `displayName` and `summary` are read by the basis builder on this path.
      const entry = {
        kind: row.kind,
        displayName: row.display_name,
        summary: row.summary ?? '',
      } as unknown as ReleaseSourceEntity;
      const recomputed = buildReleaseNotabilityBasis(entry, claims);

      const keep = published.filter((record) => record.criterion !== FALLBACK_CRITERION);
      const kept = new Set(keep.map((record) => record.criterion));
      const merged = [...keep, ...recomputed.filter((record) => !kept.has(record.criterion))].sort(
        (a, b) => a.criterion.localeCompare(b.criterion),
      );

      for (const record of merged) {
        after.set(record.criterion, (after.get(record.criterion) ?? 0) + 1);
      }

      if (merged.length === 0) {
        // Publishing requires >= 1 basis record. A row with no evidenced reason is a research gap
        // to fill, not a default to invent — the same call already made for Crescent Springs.
        wouldEmpty.push(`${row.display_name} (${row.entity_id})`);
        continue;
      }
      if (encode(published) === encode(merged)) {
        unchanged += 1;
        continue;
      }
      changes.push({ row, after: merged });
    }

    console.log('=== Apply the notability rubric ruling ===');
    console.log(`Release: ${releaseId}`);
    console.log(
      `Records: ${rows.length} | already correct: ${unchanged} | to change: ${changes.length}`,
    );

    const criteria = [...new Set([...before.keys(), ...after.keys()])].sort();
    console.log('\ncriterion                        before      after');
    for (const criterion of criteria) {
      const b = before.get(criterion) ?? 0;
      const a = after.get(criterion) ?? 0;
      const arrow = a > b ? '  +' : a < b ? '  -' : '   ';
      console.log(
        `  ${criterion.padEnd(30)} ${String(b).padStart(6)} ${String(a).padStart(10)}${arrow}`,
      );
    }

    // A criterion that disappears from a record is the failure mode this script is shaped around,
    // so it is asserted rather than trusted: the merge cannot drop one, and if the count ever falls
    // for anything but the fallback, something upstream changed and the run must not write.
    const dropped = criteria.filter(
      (criterion) =>
        criterion !== FALLBACK_CRITERION &&
        (after.get(criterion) ?? 0) < (before.get(criterion) ?? 0),
    );
    if (dropped.length > 0) {
      console.log(`\nREFUSING TO WRITE — these criteria lost records: ${dropped.join(', ')}`);
      console.log('The merge is supposed to make that impossible. Investigate before applying.');
      return;
    }

    if (wouldEmpty.length > 0) {
      console.log(
        `\nNOT WRITTEN — no evidenced reason for inclusion at all. Research, not rewrite:`,
      );
      for (const entry of wouldEmpty) console.log(`  ${entry}`);
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 APPLY_NOTABILITY_RULING=1 to apply.');
      return;
    }

    let written = 0;
    await client.query('BEGIN');
    try {
      for (const change of changes) {
        const labels = [...new Set(change.after.map((r) => NOTABILITY_RUBRIC[r.criterion]))];
        await client.query(
          `UPDATE bb_public.release_entities
             SET projection = COALESCE(projection, '{}'::jsonb)
                   || jsonb_build_object('notabilityBasis', $1::jsonb, 'notabilityLabels', $2::jsonb),
                 taxonomy = CASE
                   WHEN taxonomy ? 'notabilityLabels'
                     THEN taxonomy || jsonb_build_object('notabilityLabels', $2::jsonb)
                   ELSE taxonomy END
           WHERE release_id = $3 AND entity_id = $4`,
          [JSON.stringify(change.after), JSON.stringify(labels), releaseId, change.row.entity_id],
        );
        written += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`\nApplied: ${written} record(s).`);
    remindToRepublishCatalogArtifacts(written);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
