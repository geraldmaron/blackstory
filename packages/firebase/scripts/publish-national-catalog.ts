/**
 * Publish the national seed catalog (black-book-uda follow-on: 100+ researched entities) into
 * the ACTIVE public release's projections + search index.
 *
 * Reads every JSON file in `packages/firebase/fixtures/national-catalog/`, converts each
 * research entry into `publicEntityProjectionSchema`/`publicSearchIndexSchema`-conformant docs
 * via `@blap/domain`'s single release builder (`buildReleaseEntityArtifacts`,
 * packages/domain/src/publication/release-builder.ts — black-book-1fg9), hard-fails if ANY
 * entry does not validate or does not resolve, then batch-writes:
 *   publicReleases/<activeRelease>/entities/<id>   (projection, merge)
 *   publicSearchIndex/<id>                          (search doc, merge)
 *
 * Idempotent: re-running overwrites the same doc ids with the same content. Does NOT touch
 * `publicMeta/activeRelease` — the release pointer stays whatever bootstrap/promotion set.
 *
 * Requires:
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1
 *   Application Default Credentials with Firestore write access
 *
 * Usage:
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/publish-national-catalog.ts
 *   DRY_RUN=1 ... — validate + print without writing.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildReleaseEntityArtifacts, type ReleaseSourceEntity } from '@blap/domain';
import {
  publicEntityProjectionSchema,
  publicSearchIndexSchema,
} from '../src/firestore/types.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.BLAP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
/** Geohash character precision for public anchors — matches the bootstrap fixtures' choice. */
const GEOHASH_PRECISION = 5;

if (!ALLOW && !DRY_RUN) {
  console.error('Refusing to write: set BLAP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
  process.exit(2);
}

const catalogDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/national-catalog');

/** `ReleaseSourceEntity` (from `@blap/domain`'s release builder) mirrors this fixture format
 * 1:1 — see that type's doc comment. National-catalog JSON files parse directly into it. */

/**
 * === Publication gate wiring + single release builder (black-book-pwfi, black-book-1fg9) ===
 *
 * black-book-pwfi first wired `@blap/domain`'s two fail-closed publish gates
 * (`facts/publish-gate.ts`'s no_citations floor, `relevance/notability-gate.ts`'s
 * notability-basis requirement) into this script, working around `CatalogEntry`'s thin shape
 * with an inline placeholder `notabilityBasis` proxy and per-claim `FactCitation` stand-ins (see
 * that bead's history for the full reasoning — still relevant background on WHY the
 * archived-capture citation-completeness sub-check remains unenforced: 0 of 1031 claims across
 * all 515 fixture entries carry `archivedUrl`/`archivedAt`/`accessedAt`, a genuine pipeline-wide
 * data gap, not a defect in specific entries).
 *
 * black-book-1fg9 extracted all of that gate wiring, notability-basis construction,
 * research-coverage computation, and projection/search-doc field assembly into `@blap/domain`'s
 * `buildReleaseEntityArtifacts` (packages/domain/src/publication/release-builder.ts) so this
 * fixture-driven publish path and any future canonical-graph-driven release build share exactly
 * one implementation — the bead's "search, map, facts, and entity pages all read the same
 * release" requirement starts with "the builder that produces the release is the same builder."
 * The placeholder notability-basis proxy is gone: `buildReleaseEntityArtifacts` derives a real,
 * claim-backed `notabilityBasis` from each entry's own claims. It also adds fail-closed reference
 * resolution (topicIds against `TOPIC_REGISTRY`, notabilityBasis evidenceIds against the entry's
 * own claim ids, non-empty jurisdiction/location fields) atop the pre-existing gates, all
 * surfaced through the same `{reason, message}` shape `main()`'s `writes` loop below reports.
 *
 * NOT in this pass (explicit deferral, not a silent drop): the "two independent lineages /
 * primary+corroborating source" gate for high-impact predicates (first/only/oldest, deaths,
 * violence, allegations) and the archived-capture citation-completeness sub-check both still need
 * a richer claim/evidence model than this fixture format carries. TODO(black-book-1fg9 follow-on).
 */
function loadCatalog(): ReleaseSourceEntity[] {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`No catalog files found in ${catalogDir}`);
  }
  const entries: ReleaseSourceEntity[] = [];
  for (const file of files.sort()) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as ReleaseSourceEntity[];
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    for (const entry of parsed) entries.push(entry);
    console.log(`  ${file}: ${parsed.length} entries`);
  }
  return entries;
}

async function main(): Promise<void> {
  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Catalog: ${catalogDir}`);
  const entries = loadCatalog();

  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`Duplicate entity id in catalog: ${entry.id}`);
    ids.add(entry.id);
  }
  console.log(`Total: ${entries.length} unique entities`);

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  const db = getFirestore();

  const activeSnap = await db.doc('publicMeta/activeRelease').get();
  const releaseId = activeSnap.data()?.releaseId as string | undefined;
  if (!releaseId) throw new Error('publicMeta/activeRelease missing or has no releaseId');
  console.log(`Active release: ${releaseId}`);

  // One real "this publish happened at this instant" timestamp for the whole run — every
  // entity's generatedAt/recordUpdatedAt below shares it, matching what an actual release
  // build does (see release-builder.ts's module doc comment on why this is legitimate here
  // and NOT legitimate at web read-time).
  const generatedAt = new Date().toISOString();

  // Validate EVERYTHING before writing anything; name each failing entry so a bad catalog
  // line reads as "which record, which field", not a bare Zod trace. `buildReleaseEntityArtifacts`
  // (the single release builder, @blap/domain) runs the fact/notability gates and fail-closed
  // reference resolution; this script only re-validates the result against the Firestore-facing
  // Zod schemas (schema ownership stays in @blap/firebase, builder logic stays in @blap/domain).
  const failures: string[] = [];
  const writes = entries.flatMap((entry) => {
    try {
      const built = buildReleaseEntityArtifacts(entry, { releaseId, generatedAt, geohashPrecision: GEOHASH_PRECISION });
      if (!built.ok) {
        throw new Error(`${built.reason}: ${built.message}`);
      }
      const projection = publicEntityProjectionSchema.parse(built.projection);
      const search = publicSearchIndexSchema.parse(built.searchIndex);
      return [{ entry, projection, search }];
    } catch (error) {
      const detail =
        error instanceof Error && 'issues' in error
          ? JSON.stringify((error as { issues: unknown }).issues)
          : String(error);
      failures.push(`${entry.id}: ${detail}`);
      return [];
    }
  });
  if (failures.length > 0) {
    console.error(`INVALID ENTRIES (${failures.length}):`);
    for (const failure of failures) console.error(`  ${failure}`);
    throw new Error(`${failures.length} catalog entries failed validation; nothing written.`);
  }
  console.log(`Validated ${writes.length} projections + ${writes.length} search docs`);

  if (DRY_RUN) {
    for (const { projection } of writes.slice(0, 5)) {
      console.log(`  sample: ${projection.id} — ${projection.displayName} (${projection.kind})`);
    }
    console.log('Dry run complete; nothing written.');
    return;
  }

  // Firestore batches cap at 500 ops; chunk defensively.
  const BATCH_LIMIT = 400;
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  };
  for (const { projection, search } of writes) {
    batch.set(db.doc(`publicReleases/${releaseId}/entities/${projection.id}`), projection, {
      merge: true,
    });
    batch.set(db.doc(`publicSearchIndex/${search.id}`), search, { merge: true });
    ops += 2;
    if (ops >= BATCH_LIMIT) await flush();
  }
  await flush();

  const after = await db.collection(`publicReleases/${releaseId}/entities`).get();
  console.log(`Publish complete. Release now holds ${after.size} entity projections.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
