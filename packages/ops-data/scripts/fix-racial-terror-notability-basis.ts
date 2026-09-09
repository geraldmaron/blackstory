/**
 * repo-kdmrc (dignity slice) — repairs the published `notabilityBasis` on records about racial
 * terror killings, and on any record whose inclusion basis was built from an accusation.
 *
 * Two defects, both visible on live pages:
 *
 * 1. WRONG CRITERION. 31 of the 32 `lynching_*` person records carried
 *    `criterion: 'documented_site'`, whose ratified rubric text reads "The entity is a documented
 *    site of a historically significant event or practice (a sit-in lunch counter, a Freedom
 *    School...)". So the stated reason Alma Howze appears in this catalog was that she is a
 *    documented site. `documented_racial_terror` now exists for exactly this and is inferred
 *    ahead of every other criterion.
 *
 * 2. THE ACCUSATION AS THE REASON. `buildReleaseNotabilityBasis` emitted one basis record per
 *    claim predicate, which assumes every claim is an inclusion reason. For Alma Howze that
 *    published "Was accused of alleged murder of a dentist." as a reason she belongs here — the
 *    pretext the mob used, printed as this catalog's own justification. She was 16, pregnant and
 *    near term, and was taken from the Shubuta jail with her sister Maggie and the Clark brothers
 *    and hanged before any trial. The Equal Justice Initiative's Lynching in America records that
 *    nearly every victim was killed without being legally convicted of any offense, that such
 *    accusations were routinely fabricated, and that they were rarely seriously investigated.
 *
 * The accusation CLAIM is deliberately left in place. It is documented history and belongs on the
 * record; it simply is not a reason for inclusion. Only `notabilityBasis` (and the
 * `notabilityLabels` derived from it) are rewritten here.
 *
 * The basis is recomputed by calling `buildReleaseNotabilityBasis` itself on the row's own
 * published claims, so this script cannot drift from the builder — there is no second copy of the
 * grouping, inference or note rules here.
 *
 * SCOPE. Only rows whose recomputed basis differs AND that carry a racial-terror or accusation
 * claim. The wider catalog-of-638 `documented_site` category error is repo-kdmrc proper and needs
 * a rubric decision per kind, which this does not make.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-racial-terror-notability-basis.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_RACIAL_TERROR_BASIS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-racial-terror-notability-basis.ts
 */
import pg from 'pg';
import {
  buildReleaseNotabilityBasis,
  isAccusationPredicate,
  isRacialTerrorClaim,
  NOTABILITY_RUBRIC,
  type NotabilityBasisRecord,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_RACIAL_TERROR_BASIS_APPLY === '1';

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
  readonly claims: readonly ReleaseClaimProjection[] | null;
  readonly projection: Record<string, unknown> | null;
  readonly taxonomy: Record<string, unknown> | null;
};

function sameBasis(
  a: readonly NotabilityBasisRecord[],
  b: readonly NotabilityBasisRecord[],
): boolean {
  if (a.length !== b.length) return false;
  const encode = (r: NotabilityBasisRecord) =>
    `${r.criterion}|${r.note}|${[...r.evidenceIds].sort().join(',')}`;
  const left = a.map(encode).sort();
  const right = b.map(encode).sort();
  return left.every((value, index) => value === right[index]);
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
      `SELECT entity_id, display_name, kind, claims, projection, taxonomy
         FROM bb_public.release_entities WHERE release_id = $1 ORDER BY entity_id`,
      [releaseId],
    );

    type Change = {
      readonly row: Row;
      readonly before: readonly NotabilityBasisRecord[];
      readonly after: readonly NotabilityBasisRecord[];
      readonly droppedAccusations: readonly string[];
    };
    const changes: Change[] = [];
    let inScopeUnchanged = 0;
    const wouldEmpty: string[] = [];

    for (const row of rows) {
      const claims = Array.isArray(row.claims) ? row.claims : [];
      if (claims.length === 0) continue;

      const droppedAccusations = [
        ...new Set(
          claims
            .map((c) => c.predicate)
            .filter((p) => typeof p === 'string' && isAccusationPredicate(p)),
        ),
      ];
      const hasRacialTerror = claims.some((c) =>
        isRacialTerrorClaim(c.predicate ?? '', c.object ?? ''),
      );
      // Scope guard: this pass is the dignity slice, not the catalog-wide rubric decision.
      if (droppedAccusations.length === 0 && !hasRacialTerror) continue;

      // Only `kind` and `displayName` are read by the basis builder; the rest of
      // ReleaseSourceEntity is not consulted on this path.
      const entry = {
        kind: row.kind,
        displayName: row.display_name,
      } as unknown as ReleaseSourceEntity;
      const after = buildReleaseNotabilityBasis(entry, claims);
      const before = Array.isArray(row.projection?.notabilityBasis)
        ? (row.projection.notabilityBasis as NotabilityBasisRecord[])
        : [];

      if (after.length === 0) {
        // Publishing requires >= 1 basis record. A row whose ONLY claims are accusations has no
        // evidenced reason to be in the catalog; that is a research gap, not something to paper
        // over by keeping the allegation as the reason. Reported, never written.
        wouldEmpty.push(`${row.display_name} (${row.entity_id})`);
        continue;
      }
      // `notabilityLabels` is a stored copy of the rubric PROSE for each criterion, so editing
      // NOTABILITY_RUBRIC leaves it stale on rows whose basis records are otherwise correct.
      // Compare it too, or a rubric wording fix silently never reaches the published rows.
      const labelsAfter = [...new Set(after.map((b) => NOTABILITY_RUBRIC[b.criterion]))];
      const labelsBefore = Array.isArray(row.projection?.notabilityLabels)
        ? (row.projection.notabilityLabels as string[])
        : [];
      const labelsMatch =
        labelsBefore.length === labelsAfter.length &&
        [...labelsBefore].sort().every((v, i) => v === [...labelsAfter].sort()[i]);

      if (sameBasis(before, after) && labelsMatch) {
        inScopeUnchanged += 1;
        continue;
      }
      changes.push({ row, before, after, droppedAccusations });
    }

    console.log('=== Repair notabilityBasis for racial-terror and accusation-derived records ===');
    console.log(`Release: ${releaseId}`);
    console.log(`In scope and already correct: ${inScopeUnchanged}`);
    console.log(`To change: ${changes.length}`);
    for (const change of changes.slice(0, 12)) {
      const beforeCriteria = [...new Set(change.before.map((b) => b.criterion))].join(', ');
      const afterCriteria = [...new Set(change.after.map((b) => b.criterion))].join(', ');
      console.log(`\n  ${change.row.display_name} (${change.row.entity_id})`);
      console.log(`    criteria : ${beforeCriteria || '(none)'} -> ${afterCriteria}`);
      console.log(`    basis    : ${change.before.length} -> ${change.after.length} record(s)`);
      if (change.droppedAccusations.length > 0) {
        console.log(
          `    no longer a reason for inclusion: ${change.droppedAccusations.join('; ')}`,
        );
      }
    }
    if (changes.length > 12) console.log(`\n  ...and ${changes.length - 12} more`);

    if (wouldEmpty.length > 0) {
      console.log(`\nNOT WRITTEN — every basis record would be dropped, leaving no evidenced`);
      console.log(`reason for inclusion. These need research, not a rewrite:`);
      for (const entry of wouldEmpty) console.log(`  ${entry}`);
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run only. Set DRY_RUN=0 FIX_RACIAL_TERROR_BASIS_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const change of changes) {
        const labels = [...new Set(change.after.map((b) => NOTABILITY_RUBRIC[b.criterion]))];
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
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`\nApplied: ${changes.length} record(s) repaired.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
