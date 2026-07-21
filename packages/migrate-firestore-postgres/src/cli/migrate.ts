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
 *   pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --large
 *   pnpm --filter @repo/migrate-firestore-postgres migrate -- --apply --all
 */
import { createServerFirebaseApp, getServerFirestore } from '@repo/firebase';
import { createPgWriter } from '../pg-writer.js';
import {
  ALL_MIGRANTS,
  HIGH_VALUE_MIGRANTS,
  LARGE_MIGRANTS,
  type MigrateOptions,
} from '../migrate.js';

function parseArgs(argv: readonly string[]) {
  const mode = argv.includes('--apply') ? 'apply' : 'dry-run';
  const collections = argv
    .filter((a) => a.startsWith('--collection='))
    .map((a) => a.slice('--collection='.length));
  const limitArg = argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined;
  const wantAll = argv.includes('--all');
  const wantLarge = argv.includes('--large');
  const wantHighValue = argv.includes('--high-value') || (collections.length === 0 && !wantLarge && !wantAll);
  return {
    mode: mode as 'dry-run' | 'apply',
    wantAll,
    wantLarge,
    wantHighValue,
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

  let pool = args.wantAll
    ? ALL_MIGRANTS
    : args.wantLarge && !args.wantHighValue
      ? LARGE_MIGRANTS
      : args.wantLarge && args.wantHighValue
        ? ALL_MIGRANTS
        : HIGH_VALUE_MIGRANTS;

  if (args.collections.length > 0) {
    pool = ALL_MIGRANTS.filter((m) => args.collections.includes(m.name));
  }

  if (pool.length === 0) {
    console.error(
      'No matching collections. Known:',
      ALL_MIGRANTS.map((m) => m.name).join(', '),
    );
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

  console.log(JSON.stringify({ mode: args.mode, collections: pool.map((s) => s.name) }));

  const results = [];
  for (const migrant of pool) {
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
