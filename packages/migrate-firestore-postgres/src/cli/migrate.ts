/**
 * CLI: dry-run or apply Firestore → Supabase Postgres migration for selected collections.
 *
 * Env:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1
 *   FIREBASE_PROJECT_ID=black-book-efaaf
 *   DATABASE_URL=postgresql://...  (required for --apply; direct Postgres, not PostgREST)
 *
 * Usage:
 *   pnpm --filter @repo/migrate-firestore-postgres migrate -- --dry-run
 *   pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --collection=policy
 *   pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --high-value
 */
import { createServerFirebaseApp, getServerFirestore } from '@repo/firebase';
import { createPgWriter } from '../pg-writer.js';
import { HIGH_VALUE_MIGRANTS, type MigrateOptions } from '../migrate.js';

function parseArgs(argv: readonly string[]) {
  const mode = argv.includes('--apply') ? 'apply' : 'dry-run';
  const highValue = argv.includes('--high-value') || !argv.some((a) => a.startsWith('--collection='));
  const collections = argv
    .filter((a) => a.startsWith('--collection='))
    .map((a) => a.slice('--collection='.length));
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined;
  return {
    mode: mode as 'dry-run' | 'apply',
    highValue: collections.length === 0 ? true : highValue && collections.length === 0,
    collections,
    ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  createServerFirebaseApp(process.env);
  const db = getServerFirestore();

  let writer: ReturnType<typeof createPgWriter> | undefined;
  if (args.mode === 'apply') {
    const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim();
    if (!databaseUrl) {
      console.error('DATABASE_URL (or SUPABASE_DB_URL) required for --apply');
      process.exitCode = 1;
      return;
    }
    writer = createPgWriter(databaseUrl);
  }

  const selected =
    args.collections.length > 0
      ? HIGH_VALUE_MIGRANTS.filter((m) => args.collections.includes(m.name))
      : HIGH_VALUE_MIGRANTS;

  if (selected.length === 0) {
    console.error('No matching collections. Known:', HIGH_VALUE_MIGRANTS.map((m) => m.name).join(', '));
    process.exitCode = 1;
    return;
  }

  const options: MigrateOptions = {
    db,
    mode: args.mode,
    ...(writer ? { writer } : {}),
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    defaultReleaseId: 'rel_seed_001',
  };

  console.log(JSON.stringify({ mode: args.mode, collections: selected.map((s) => s.name) }));

  const results = [];
  for (const migrant of selected) {
    const result = await migrant.run(options);
    results.push(result);
    console.log(JSON.stringify(result));
  }

  const totals = results.reduce(
    (acc, r) => ({
      read: acc.read + r.read,
      written: acc.written + r.written,
      skipped: acc.skipped + r.skipped,
      errors: acc.errors + r.errors.length,
    }),
    { read: 0, written: 0, skipped: 0, errors: 0 },
  );
  console.log(JSON.stringify({ totals }, null, 2));

  if (writer) await writer.end();
  if (totals.errors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
