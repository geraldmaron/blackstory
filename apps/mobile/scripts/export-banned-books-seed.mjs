/**
 * Export the banned-books listing from Supabase into the mobile JSON catalog.
 *
 * Source of truth is the `bannedBooksListing` row in bb_public.materialized_snapshots
 * (published by packages/ops-data/scripts/load-banned-books-to-supabase.ts), not a
 * committed TS seed.
 *
 * Run from repo root via the single entrypoint:
 *   node --conditions=development --import tsx apps/mobile/scripts/generate-seeds.mjs books
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePgConnectionString } from '../../../packages/ops-data/scripts/lib/pg-connection.ts';

const here = dirname(fileURLToPath(import.meta.url));
// `pg` is a dependency of ops-data, not the mobile app — resolve it from there.
const requireFromOpsData = createRequire(
  resolve(here, '../../../packages/ops-data/package.json'),
);
const pg = requireFromOpsData('pg');
const outPath = resolve(here, '../src/features/books/catalog-seed.json');

const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.APP_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error('DATABASE_URL (or APP_DATABASE_URL) is required — source apps/web/.env.local');
}
const conn = normalizePgConnectionString(databaseUrl);
const client = new pg.Client({
  connectionString: conn.connectionString,
  ...(conn.ssl ? { ssl: conn.ssl } : {}),
});
await client.connect();
const { rows } = await client.query(
  `SELECT payload FROM bb_public.materialized_snapshots WHERE name = 'bannedBooksListing'`,
);
await client.end();

const snapshot = rows[0]?.payload;
if (!snapshot || !Array.isArray(snapshot.books) || snapshot.books.length === 0) {
  throw new Error(
    'bannedBooksListing snapshot is missing or empty — run packages/ops-data/scripts/load-banned-books-to-supabase.ts first',
  );
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${outPath} (${snapshot.books.length} books, version ${snapshot.version})`,
);
