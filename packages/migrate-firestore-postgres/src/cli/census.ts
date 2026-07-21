/**
 * CLI: census live Firestore root collection document counts.
 *
 * Usage:
 *   APP_FIREBASE_ALLOW_PRODUCTION=1 FIREBASE_PROJECT_ID=black-book-efaaf \
 *     pnpm --filter @repo/migrate-firestore-postgres census
 */
import { createServerFirebaseApp, getServerFirestore } from '@repo/firebase';
import { runCensus } from '../migrate.js';

async function main(): Promise<void> {
  createServerFirebaseApp(process.env);
  const db = getServerFirestore();
  const rows = await runCensus(db);
  const nonempty = rows.filter((r) => r.count > 0);
  const empty = rows.filter((r) => r.count === 0);
  for (const row of rows) {
    console.log(JSON.stringify(row));
  }
  console.log(
    JSON.stringify(
      {
        nonempty: nonempty.length,
        empty: empty.length,
        totalDocs: nonempty.reduce((sum, r) => sum + r.count, 0),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
