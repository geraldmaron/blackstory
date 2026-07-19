
/**
 * Shared idempotent batch upsert for contentHash-carrying statistic/dataset docs — the ONE
 * implementation of the compare-then-set discipline every bulk loader uses (consolidated
 * 2026-07-18; previously triplicated across the ACS tract writer and the Opportunity
 * Atlas / HOLC ingest scripts).
 *
 * Contract: docs carry `{id, contentHash, createdAt}`. Existing docs whose contentHash
 * matches are skipped (`unchanged`); changed docs are rewritten with the ORIGINAL
 * createdAt preserved (`updated`); new docs are written as-is (`created`). Writes go in
 * batches of 400 (Firestore's 500-op ceiling with headroom, matching
 * publish-national-catalog.ts).
 */
import type { CollectionReference, Firestore } from 'firebase-admin/firestore';

const BATCH_LIMIT = 400;

export type BatchUpsertSummary = { created: number; updated: number; unchanged: number };

export type HashedDoc = {
  readonly id: string;
  readonly contentHash: string;
  readonly createdAt: string;
};

/** THE writer contract every bulk statistic loader takes as its injectable seam: apply a
 * built batch idempotently, report outcome counts. Live implementations compose
 * `loadExistingHashes` + `idempotentBatchUpsert`; tests use an in-memory Map. */
export type DocBatchWriter<T extends HashedDoc> = {
  applyAll(docs: readonly T[]): Promise<BatchUpsertSummary>;
};

/** Single-doc upsert preserving the original createdAt — the one implementation of the
 * compare-then-set discipline for non-hashed harness docs (used by capture.ts). */
export async function setPreservingCreatedAt(
  firestore: Firestore,
  collectionName: string,
  doc: { readonly id: string; readonly createdAt: string },
): Promise<void> {
  const ref = firestore.collection(collectionName).doc(doc.id);
  const existing = await ref.get();
  const createdAt = (existing.data() as { createdAt?: string } | undefined)?.createdAt;
  await ref.set(createdAt ? { ...doc, createdAt } : doc);
}

/** One projection read of `{contentHash, createdAt}` for the idempotency compare — pass a
 * `where`-narrowed query for big collections (e.g. per-state) instead of a full scan. */
export async function loadExistingHashes(
  collection: CollectionReference,
  where?: { readonly field: string; readonly value: string },
): Promise<Map<string, { contentHash?: string; createdAt?: string }>> {
  const query = where ? collection.where(where.field, '==', where.value) : collection;
  const snapshot = await query.select('contentHash', 'createdAt').get();
  return new Map(
    snapshot.docs.map((doc) => [doc.id, doc.data() as { contentHash?: string; createdAt?: string }]),
  );
}

export async function idempotentBatchUpsert<T extends HashedDoc>(
  firestore: Firestore,
  collection: CollectionReference,
  docs: readonly T[],
  existing: ReadonlyMap<string, { contentHash?: string; createdAt?: string }>,
): Promise<BatchUpsertSummary> {
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let batch = firestore.batch();
  let ops = 0;
  const flush = async () => {
    if (ops > 0) await batch.commit();
    batch = firestore.batch();
    ops = 0;
  };

  for (const doc of docs) {
    const prior = existing.get(doc.id);
    if (prior?.contentHash === doc.contentHash) {
      unchanged += 1;
      continue;
    }
    batch.set(collection.doc(doc.id), prior?.createdAt ? { ...doc, createdAt: prior.createdAt } : doc);
    ops += 1;
    if (prior) updated += 1;
    else created += 1;
    if (ops >= BATCH_LIMIT) await flush();
  }
  await flush();
  return { created, updated, unchanged };
}
