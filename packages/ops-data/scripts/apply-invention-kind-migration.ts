/**
 * Apply the invention-kind constraint migration if the live check still rejects
 * `invention`. Idempotent: the SQL drops and recreates the named constraints.
 *
 *   DRY_RUN=0 APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/apply-invention-kind-migration.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { DB_RELATIONSHIP_TYPES } from '@repo/schemas/relationship-vocabulary';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

/** The constraint's value list, rendered from the shared vocabulary rather than restated here. */
const RELATIONSHIP_TYPE_SQL_LIST = DB_RELATIONSHIP_TYPES.map((type) => `'${type}'`).join(', ');

const APPLY = process.env.APPLY === '1' && process.env.DRY_RUN === '0';
const SQL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../supabase/migrations/20260908120000_invention_kind_and_contribution_predicates.sql',
);

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString);
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();
  try {
    const before = await client.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conname = 'entities_kind_check'`,
    );
    const already = before.rows[0]?.def.includes("'invention'") ?? false;
    console.log(
      already
        ? 'invention already in entities_kind_check'
        : 'invention missing from entities_kind_check',
    );
    if (!APPLY) {
      console.log('dry-run');
      return;
    }
    if (already) return;
    const sql = readFileSync(SQL_PATH, 'utf8');
    if (!sql.includes("'invention'")) {
      throw new Error(`migration file missing invention kind: ${SQL_PATH}`);
    }
    await client.query('BEGIN');
    await client.query(
      'ALTER TABLE bb_canonical.entities DROP CONSTRAINT IF EXISTS entities_kind_check',
    );
    await client.query(`
      ALTER TABLE bb_canonical.entities ADD CONSTRAINT entities_kind_check
      CHECK (kind IN (
        'person', 'place', 'school', 'organization', 'institution', 'event',
        'law', 'case', 'publication', 'artifact', 'movement', 'invention', 'other'
      ))
    `);
    await client.query(
      'ALTER TABLE bb_canonical.entity_relationships DROP CONSTRAINT IF EXISTS entity_relationships_typed_predicate',
    );
    await client.query(
      'ALTER TABLE bb_canonical.entity_relationships DROP CONSTRAINT IF EXISTS entity_relationships_relationship_type_check',
    );
    await client.query(`
      ALTER TABLE bb_canonical.entity_relationships
        ADD CONSTRAINT entity_relationships_relationship_type_check
        CHECK (relationship_type IN (${RELATIONSHIP_TYPE_SQL_LIST}))
    `);
    await client.query(
      `INSERT INTO supabase_migrations.schema_migrations (version)
       VALUES ('20260908120000')
       ON CONFLICT DO NOTHING`,
    );
    await client.query('COMMIT');
    console.log('applied 20260908120000');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
