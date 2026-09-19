/**
 * Repairs inclusion reasons for racial-terror records. Accusations may remain attributed
 * historical claims, but must not become the archive's reason for commemorating a victim. Use
 * the shared rubric to select supported killing claims.
 */
import pg from 'pg';
import {
  buildReleaseNotabilityBasis,
  isAccusationPredicate,
  isRacialTerrorRecord,
  NOTABILITY_RUBRIC,
  type NotabilityBasisRecord,
  type ReleaseClaimProjection,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
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
  readonly summary: string | null;
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
      `SELECT release_id FROM published.v_active_release_id`,
    );
    const releaseId = active.rows[0]?.release_id;
    if (!releaseId) throw new Error('No active release');

    const { rows } = await client.query<Row>(
      `SELECT entity_id, display_name, kind, summary, claims, projection, taxonomy
         FROM published.release_entities WHERE release_id = $1 ORDER BY entity_id`,
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
      // Only `kind`, `displayName` and `summary` are read on this path; the rest of
      // ReleaseSourceEntity is not consulted by the basis builder.
      const entry = {
        kind: row.kind,
        displayName: row.display_name,
        summary: row.summary ?? '',
      } as unknown as ReleaseSourceEntity;

      const hasRacialTerror = isRacialTerrorRecord(entry, claims);
      // Scope guard: this pass is the dignity slice, not the catalog-wide rubric decision.
      if (droppedAccusations.length === 0 && !hasRacialTerror) continue;
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
    // A dry run prints every change. The point of the dry run is that a person reads the whole
    // list before it is written — the racial-terror rule is a judgment about how this catalog
    // names the dead, and a truncated preview is how a false positive ships.
    const preview = DRY_RUN || !APPLY ? changes : changes.slice(0, 12);
    for (const change of preview) {
      const beforeCriteria = [...new Set(change.before.map((b) => b.criterion))].join(', ');
      const afterCriteria = [...new Set(change.after.map((b) => b.criterion))].join(', ');
      console.log(`\n  ${change.row.display_name} (${change.row.entity_id})`);
      console.log(`    criteria : ${beforeCriteria || '(none)'} -> ${afterCriteria}`);
      console.log(`    basis    : ${change.before.length} -> ${change.after.length} record(s)`);
      for (const record of change.after) console.log(`      · ${record.note.slice(0, 110)}`);
      if (change.droppedAccusations.length > 0) {
        console.log(
          `    no longer a reason for inclusion: ${change.droppedAccusations.join('; ')}`,
        );
      }
    }
    if (preview.length < changes.length) {
      console.log(`\n  ...and ${changes.length - preview.length} more`);
    }

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
          `UPDATE published.release_entities
             SET projection = COALESCE(projection, '{}'::jsonb)
                   || jsonb_build_object('notabilityBasis', $1::jsonb, 'notabilityLabels', $2::jsonb)
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
    remindToRepublishCatalogArtifacts(changes.length);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
