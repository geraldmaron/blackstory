/**
 * repo-j4q1 mitigation: us-ed-hbcu-* landscape_candidates rows carry no payload.city/state at
 * all, which starves subject-identity.ts's place-corroboration check and let a Wikipedia search
 * for "Lincoln University" (the Missouri HBCU) attach evidence about the unrelated University of
 * Lincoln in England — the identity gate fell back to weak name-only matching because it had no
 * place to check against. This backfills city/state from the NCES College Navigator address
 * already captured this session (bb_research.entity_evidence, collector='nces-navigator'),
 * a government source keyed by UNITID (the entity_id's own numeric suffix) — not invented, not
 * guessed. One-off backfill, not part of the regular pipeline.
 *
 * Usage: DRY_RUN=0 BACKFILL_HBCU_CITY_STATE_APPLY=1 to apply.
 */
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.BACKFILL_HBCU_CITY_STATE_APPLY === '1';

function parseAddress(address: string): { city: string; state: string } | null {
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length < 2) return null;
  const city = parts[parts.length - 2];
  const stateZip = parts[parts.length - 1];
  const match = /^(.+?)\s+\d{5}(-\d{4})?$/u.exec(stateZip);
  const state = match ? match[1] : stateZip;
  if (!city || !state) return null;
  return { city, state };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const rows = await pool.query<{ entity_id: string; address: string }>(
    `SELECT ev.entity_id, ev.provenance->'facts'->>'address' as address
       FROM bb_research.entity_evidence ev
       JOIN bb_research.landscape_candidates lc ON lc.id = ev.entity_id
      WHERE ev.collector = 'nces-navigator' AND ev.status = 'captured'
        AND (lc.payload->>'city' IS NULL OR lc.payload->>'state' IS NULL)`,
  );

  console.log(`${rows.rows.length} row(s) missing city/state with a captured NCES address.`);

  let applied = 0;
  for (const row of rows.rows) {
    const parsed = row.address ? parseAddress(row.address) : null;
    if (!parsed) {
      console.log(`  ${row.entity_id} — skip: could not parse address "${row.address}"`);
      continue;
    }
    console.log(`  ${row.entity_id} — city="${parsed.city}" state="${parsed.state}"`);
    if (!DRY_RUN && APPLY) {
      await pool.query(
        `UPDATE bb_research.landscape_candidates
            SET payload = payload || jsonb_build_object('city', $2::text, 'state', $3::text)
          WHERE id = $1`,
        [row.entity_id, parsed.city, parsed.state],
      );
      applied += 1;
    }
  }

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 BACKFILL_HBCU_CITY_STATE_APPLY=1 to apply.',
    );
  } else {
    console.log(`\nApplied: ${applied} row(s) updated.`);
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
