/**
 * Loads authored law_applicability rows for Lives Across the Decades from a JSON file, validating
 * each against the active release before anything is written: the entity must be published, every
 * basis claim must be a cited claim on a published record, and every in-force year must appear in
 * the text of a basis claim. Rows are data, so the JSON lives outside git (session scratch or
 * .cache).
 *
 * Canonical coverage is reported, not required. The incremental publisher writes bb_public
 * directly, and backfill-canonical-claims-from-release.ts only reaches entities with no canonical
 * claims at all, so a sourced claim added to an already-traced record can be public before it
 * has a canonical row. Missing rows are listed so the trace gap stays visible.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   # Dry-run (default): validates and prints every row's verdict
 *   node --conditions development --import tsx packages/ops-data/scripts/lives-load-applicability.ts \
 *     --file=/path/to/chicago-applicability.json
 *   # Apply (writes only when every row validates)
 *   DRY_RUN=0 LIVES_APPLICABILITY_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/lives-load-applicability.ts --file=/path/to/chicago-applicability.json
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import {
  validateApplicability,
  type ApplicabilityDbRow,
  type AuthoredApplicability,
} from '../src/lives/applicability.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.LIVES_APPLICABILITY_APPLY === '1';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main(): Promise<void> {
  const file = arg('file');
  if (!file) throw new Error('--file=<authored applicability JSON> is required');
  const authored = JSON.parse(readFileSync(file, 'utf8')) as AuthoredApplicability[];
  if (!Array.isArray(authored)) throw new Error('file must hold a JSON array of rows');
  const duplicateIds = authored
    .map((row) => row.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) throw new Error(`duplicate ids: ${duplicateIds.join(', ')}`);

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  try {
    const entityIds = [...new Set(authored.map((row) => row.entityId))];
    const claimIds = [...new Set(authored.flatMap((row) => row.basisClaimIds))];
    const jurisdictionIds = [...new Set(authored.map((row) => row.jurisdictionId))];

    const [entities, jurisdictions, canonical, texts] = await Promise.all([
      pool.query<{ id: string }>(
        `SELECT DISTINCT e.projection->>'id' AS id
         FROM bb_public.release_entities e
         JOIN bb_public.active_release a ON a.release_id = e.release_id
         WHERE e.projection->>'id' = ANY($1::text[])`,
        [entityIds],
      ),
      pool.query<{ id: string }>(
        'SELECT id FROM bb_reference.jurisdictions WHERE id = ANY($1::text[])',
        [jurisdictionIds],
      ),
      pool.query<{ id: string }>(
        `SELECT id FROM bb_canonical.claims
         WHERE id = ANY($1::text[]) AND publication_status = 'published'`,
        [claimIds],
      ),
      pool.query<{ id: string; text: string }>(
        `SELECT DISTINCT claim->>'id' AS id,
                concat_ws(' ', claim->>'object', claim->>'citationLabel') AS text
         FROM bb_public.release_entities e
         JOIN bb_public.active_release a ON a.release_id = e.release_id,
              jsonb_array_elements(e.projection->'claims') AS claim
         WHERE claim->>'id' = ANY($1::text[])
           AND coalesce(claim->>'citationHref', '') <> ''`,
        [claimIds],
      ),
    ]);

    const canonicalIds = new Set(canonical.rows.map((row) => row.id));
    const claimText = new Map(texts.rows.map((row) => [row.id, row.text]));
    const untraced = [...claimText.keys()].filter((id) => !canonicalIds.has(id));
    if (untraced.length > 0) {
      console.log(
        `warning: ${untraced.length} basis claim(s) have no canonical row yet: ${untraced.join(', ')}`,
      );
    }
    const context = {
      entityIds: new Set(entities.rows.map((row) => row.id)),
      jurisdictionIds: new Set(jurisdictions.rows.map((row) => row.id)),
      claimText,
    };

    const results = authored.map((row) => validateApplicability(row, context));
    const failures = results.filter((result) => !result.ok);
    for (const result of results) {
      if (result.ok) {
        console.log(
          `ok    ${result.row.id}  ${result.row.in_force_span}  ${result.row.applies_to_slices.join(',')}`,
        );
      } else {
        console.log(`FAIL  ${result.id}\n      ${result.errors.join('\n      ')}`);
      }
    }
    console.log(`${results.length - failures.length} valid, ${failures.length} failing`);
    if (failures.length > 0) {
      process.exitCode = 1;
      return;
    }
    if (!apply) {
      console.log('Dry run. Set DRY_RUN=0 LIVES_APPLICABILITY_APPLY=1 to write.');
      return;
    }

    const rows = results.flatMap((result) =>
      result.ok ? [result.row] : [],
    ) as ApplicabilityDbRow[];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const row of rows) {
        await client.query(
          `INSERT INTO bb_reference.law_applicability (
             id, entity_id, jurisdiction_id, scope_level, in_force_from_edtf, in_force_to_edtf,
             in_force_span, date_precision, groups_named, applies_to_slices, life_domains,
             text_posture, disputed, basis_claim_ids, notes, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::daterange,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (id) DO UPDATE SET
             entity_id = EXCLUDED.entity_id,
             jurisdiction_id = EXCLUDED.jurisdiction_id,
             scope_level = EXCLUDED.scope_level,
             in_force_from_edtf = EXCLUDED.in_force_from_edtf,
             in_force_to_edtf = EXCLUDED.in_force_to_edtf,
             in_force_span = EXCLUDED.in_force_span,
             date_precision = EXCLUDED.date_precision,
             groups_named = EXCLUDED.groups_named,
             applies_to_slices = EXCLUDED.applies_to_slices,
             life_domains = EXCLUDED.life_domains,
             text_posture = EXCLUDED.text_posture,
             disputed = EXCLUDED.disputed,
             basis_claim_ids = EXCLUDED.basis_claim_ids,
             notes = EXCLUDED.notes,
             status = EXCLUDED.status,
             updated_at = now()`,
          [
            row.id,
            row.entity_id,
            row.jurisdiction_id,
            row.scope_level,
            row.in_force_from_edtf,
            row.in_force_to_edtf,
            row.in_force_span,
            row.date_precision,
            row.groups_named,
            row.applies_to_slices,
            row.life_domains,
            row.text_posture,
            row.disputed,
            row.basis_claim_ids,
            row.notes,
            row.status,
          ],
        );
      }
      await client.query('COMMIT');
      console.log(`Wrote ${rows.length} law_applicability row(s).`);
    } catch (error) {
      await client.query('ROLLBACK');
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
