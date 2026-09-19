/**
 * Repairs stale inclusion notes, unsupported first-person criteria and unresolved evidence ids
 * on the specified civil-rights records. Summary corrections must also reach derived inclusion
 * explanations and search copies.
 */
import pg from 'pg';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_CRL_NOTABILITY_APPLY === '1';

const SHIRLEY_ID = 'civil-rights-leaders-calvin-shirley';
const PENN_ID = 'civil-rights-leaders-william-f-penn';

type NotabilityBasis = {
  readonly criterion: string;
  readonly note: string;
  readonly evidenceIds: readonly string[];
};

const REWRITES: Readonly<Record<string, NotabilityBasis>> = {
  [SHIRLEY_ID]: {
    criterion: 'movement_significance',
    note: 'One of four Black physicians who sued to integrate the all-white staff of Broward General Hospital, opening its closed doors to physicians of color, and was instrumental in getting the county health department to build the Northwest Health Center in a predominantly Black Fort Lauderdale neighborhood.',
    evidenceIds: [
      'claim_civil_rights_leaders_calvin_shirley_01',
      'claim_civil_rights_leaders_calvin_shirley_04',
    ],
  },
  [PENN_ID]: {
    criterion: 'movement_significance',
    note: "A founding member of the NAACP's Atlanta branch who appears among its officers and executive committee in a 1917 photograph held in the association's own records at the Library of Congress, and a founder of the Fair Haven Infirmary, a hospital serving Atlanta's Black community.",
    evidenceIds: [
      'claim_civil_rights_leaders_william_f_penn_04',
      'claim_civil_rights_leaders_william_f_penn_05',
      'claim_civil_rights_leaders_william_f_penn_01',
    ],
  },
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const releaseId = (
      await client.query<{ release_id: string }>(
        `SELECT release_id FROM published.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    const ids = Object.keys(REWRITES);
    const rows = (
      await client.query<{ id: string; notability_basis: NotabilityBasis[]; claim_ids: string[] }>(
        `SELECT e.id,
                e.notability_basis,
                ARRAY(
                  SELECT jsonb_array_elements(re.claims) ->> 'id'
                ) AS claim_ids
         FROM canonical.entities e
         JOIN published.release_entities re
           ON re.entity_id = e.id AND re.release_id = $1
         WHERE e.id = ANY($2::text[])`,
        [releaseId, ids],
      )
    ).rows;
    for (const id of ids)
      if (!rows.some((row) => row.id === id)) throw new Error(`${id} not found`);

    console.log('=== repo-wqtq: notability_basis resync ===\n');
    for (const row of rows) {
      const next = REWRITES[row.id]!;
      const dangling = next.evidenceIds.filter((claimId) => !row.claim_ids.includes(claimId));
      if (dangling.length > 0)
        throw new Error(`${row.id}: evidenceIds reference missing claims: ${dangling.join(', ')}`);
      const before = row.notability_basis[0];
      console.log(`--- ${row.id}`);
      console.log(`  criterion:   ${before?.criterion} -> ${next.criterion}`);
      console.log(`  evidenceIds: ${JSON.stringify(before?.evidenceIds)} -> resolve, all present`);
      console.log(`  note before: ${before?.note}`);
      console.log(`  note after:  ${next.note}\n`);
    }

    if (DRY_RUN || !APPLY) {
      console.log('Dry run. Set DRY_RUN=0 FIX_CRL_NOTABILITY_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const id of ids) {
        const json = JSON.stringify([REWRITES[id]]);
        await client.query(
          `UPDATE canonical.entities
           SET notability_basis = $2::jsonb, updated_at = now()
           WHERE id = $1`,
          [id, json],
        );
        await client.query(
          `UPDATE published.release_entities
           SET projection = jsonb_set(projection, '{notabilityBasis}', $3::jsonb, true)
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, id, json],
        );
      }
      await client.query('COMMIT');
      console.log('Applied.');
      remindToRepublishCatalogArtifacts(ids.length);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
