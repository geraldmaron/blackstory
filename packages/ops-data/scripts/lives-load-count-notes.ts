/**
 * Loads Lives count notes from LIVES_COUNT_NOTES_FILE into reference.lives_count_notes. Default
 * dry-run; writes require DRY_RUN=0 and LIVES_LOAD_COUNT_NOTES_APPLY=1.
 * LIVES_COUNT_NOTES_PRUNE=1 additionally removes omitted notes.
 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { validateLivesCountNotes } from '../src/lives/count-notes.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const apply = process.env.DRY_RUN === '0' && process.env.LIVES_LOAD_COUNT_NOTES_APPLY === '1';
const prune = process.env.LIVES_COUNT_NOTES_PRUNE === '1';

async function main(): Promise<void> {
  const file = process.env.LIVES_COUNT_NOTES_FILE;
  if (!file) throw new Error('LIVES_COUNT_NOTES_FILE is required');
  const { records, errors } = validateLivesCountNotes(JSON.parse(await readFile(file, 'utf8')));
  if (errors.length > 0) throw new Error(`invalid notes:\n${errors.join('\n')}`);
  const perDecade: Record<number, number> = {};
  for (const record of records) perDecade[record.decade] = (perDecade[record.decade] ?? 0) + 1;
  console.log(JSON.stringify({ apply, prune, notes: records.length, perDecade }, null, 2));
  if (!apply) {
    console.log('Dry run. Set DRY_RUN=0 LIVES_LOAD_COUNT_NOTES_APPLY=1 to write.');
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool(normalizePgConnectionString(url));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const note of records) {
      await client.query(
        `INSERT INTO reference.lives_count_notes
          (id, decade, applies_to, area_ids, heading, body, citations, sort_order, status)
         VALUES ($1, $2, $3::text[], $4::text[], $5, $6, $7::jsonb, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           decade = EXCLUDED.decade, applies_to = EXCLUDED.applies_to, area_ids = EXCLUDED.area_ids,
           heading = EXCLUDED.heading, body = EXCLUDED.body, citations = EXCLUDED.citations,
           sort_order = EXCLUDED.sort_order, status = EXCLUDED.status, updated_at = now()`,
        [
          note.id,
          note.decade,
          note.appliesTo,
          note.areaIds,
          note.heading,
          note.body,
          JSON.stringify(note.citations),
          note.sortOrder,
          note.status,
        ],
      );
    }
    if (prune) {
      const removed = await client.query(
        'DELETE FROM reference.lives_count_notes WHERE NOT (id = ANY($1::text[]))',
        [records.map((note) => note.id)],
      );
      console.log(`Removed ${removed.rowCount ?? 0} note(s) not in the file.`);
    }
    await client.query('COMMIT');
    console.log(`Upserted ${records.length} note(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
