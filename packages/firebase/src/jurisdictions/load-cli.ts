/**
 * Idempotent load/refresh CLI for the `jurisdictions` collection.
 *
 * Loads 51 state docs (from `@repo/domain`'s `US_STATES` see `./us-states-source.ts`)
 * plus ~3,143 county docs (from a Census Gazetteer county file see `./tiger-gazetteer.ts`).
 * Structurally mirrors `packages/firebase/src/embeddings/backfill-cli.ts`: every dependency
 * (writer) is injected so `runJurisdictionLoad` is fully unit-testable without Firestore, and
 * only the `if (import.meta.url ===...)` block at the bottom touches real infrastructure or
 * the filesystem.
 *
 * Idempotency: `createFirestoreJurisdictionWriter` reads the existing doc before writing and
 * skips the write when every field except `updatedAt` is unchanged (deterministic ids from
 * `./schema.ts` already guarantee re-running never creates a duplicate doc; this additionally
 * avoids a no-op `updatedAt` churn on every re-run).
 *
 * Run directly with tsx, e.g.:
 * node --conditions development --import tsx \
 * packages/firebase/src/jurisdictions/load-cli.ts --gazetteer-file /path/to/2024_Gaz_counties_national.txt
 *
 * Obtaining the real Census Gazetteer file: see ./tiger-gazetteer.ts's module doc for the
 * download URL and format. States never require a download they come from the
 * already-committed `US_STATES` table.
 *
 * No live apply from automation: this script is unit-tested against an injected fake writer
 * only. Per project policy, a human operator must run the live apply against Firestore.
 */
import { createServerFirebaseApp } from '../server.js';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import { createFirestoreJurisdictionResolver } from './resolver.js';
import { parseGazetteerCountyFile, buildCountyJurisdictionDocs } from './tiger-gazetteer.js';
import { buildStateJurisdictionDocs } from './us-states-source.js';
import { jurisdictionSchema, type JurisdictionDoc } from './schema.js';

export type JurisdictionWriteOutcome = 'created' | 'updated' | 'unchanged';

export type JurisdictionWriter = {
  /** Upserts one doc idempotently and reports what actually happened. */
  upsert(doc: JurisdictionDoc): Promise<JurisdictionWriteOutcome>;
};

export type RunJurisdictionLoadOptions = {
  readonly writer: JurisdictionWriter;
  /** Raw Census Gazetteer county file text; omit to load states only. */
  readonly gazetteerFileText?: string;
  readonly now?: () => string;
  readonly sourceVersion?: string;
};

export type RunJurisdictionLoadSummary = {
  readonly statesProcessed: number;
  readonly countiesProcessed: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejectedGazetteerRows: readonly { readonly line: number; readonly reason: string }[];
  readonly outOfScopeCounties: readonly { readonly geoid: string; readonly usps: string }[];
};

export async function runJurisdictionLoad(
  options: RunJurisdictionLoadOptions,
): Promise<RunJurisdictionLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const buildOptions = {
    now,
    ...(options.sourceVersion ? { sourceVersion: options.sourceVersion } : {}),
  };

  const stateDocs = buildStateJurisdictionDocs(buildOptions);

  let countyDocs: readonly JurisdictionDoc[] = [];
  let rejectedGazetteerRows: RunJurisdictionLoadSummary['rejectedGazetteerRows'] = [];
  let outOfScopeCounties: RunJurisdictionLoadSummary['outOfScopeCounties'] = [];

  if (options.gazetteerFileText !== undefined) {
    const parsed = parseGazetteerCountyFile(options.gazetteerFileText);
    rejectedGazetteerRows = parsed.rejected;
    const built = buildCountyJurisdictionDocs(parsed.rows, buildOptions);
    countyDocs = built.docs;
    outOfScopeCounties = built.outOfScope;
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const doc of [...stateDocs, ...countyDocs]) {
    jurisdictionSchema.parse(doc); // fail closed on a malformed doc before it ever reaches Firestore
    const outcome = await options.writer.upsert(doc);
    if (outcome === 'created') created += 1;
    else if (outcome === 'updated') updated += 1;
    else unchanged += 1;
  }

  return {
    statesProcessed: stateDocs.length,
    countiesProcessed: countyDocs.length,
    created,
    updated,
    unchanged,
    rejectedGazetteerRows,
    outOfScopeCounties,
  };
}

/** Compares every field except `createdAt`/`updatedAt` for idempotency's "unchanged" check. */
export function jurisdictionDocsEqualIgnoringTimestamps(
  a: JurisdictionDoc,
  b: JurisdictionDoc,
): boolean {
  const { createdAt: _a1, updatedAt: _a2, ...restA } = a;
  const { createdAt: _b1, updatedAt: _b2, ...restB } = b;
  return JSON.stringify(restA) === JSON.stringify(restB);
}

function parseArgs(argv: readonly string[]): { gazetteerFile?: string; sourceVersion?: string } {
  const result: { gazetteerFile?: string; sourceVersion?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--gazetteer-file') {
      const value = argv[++index];
      if (value !== undefined) result.gazetteerFile = value;
    } else if (arg === '--source-version') {
      const value = argv[++index];
      if (value !== undefined) result.sourceVersion = value;
    }
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));

  const [{ getFirestore }, fs] = await Promise.all([
    import('firebase-admin/firestore'),
    import('node:fs/promises'),
  ]);

  const { app } = createServerFirebaseApp(process.env);
  const firestore = getFirestore(app);
  const resolver = createFirestoreJurisdictionResolver(firestore);
  const collection = firestore.collection(FIRESTORE_ROOT.jurisdictions);

  const firestoreWriter: JurisdictionWriter = {
    async upsert(doc) {
      const existing = await resolver.get(doc.id);
      if (existing && jurisdictionDocsEqualIgnoringTimestamps(existing, doc)) {
        return 'unchanged';
      }
      await collection.doc(doc.id).set(doc);
      return existing ? 'updated' : 'created';
    },
  };

  const gazetteerFileText = args.gazetteerFile
    ? await fs.readFile(args.gazetteerFile, 'utf-8')
    : undefined;

  const summary = await runJurisdictionLoad({
    writer: firestoreWriter,
    ...(gazetteerFileText !== undefined ? { gazetteerFileText } : {}),
    ...(args.sourceVersion ? { sourceVersion: args.sourceVersion } : {}),
  });

  console.log(JSON.stringify(summary, null, 2));
}
