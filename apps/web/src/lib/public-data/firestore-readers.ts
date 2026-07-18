/**
 * Server-side Firestore readers for public release projections.
 * Lives under `lib/` (not `app/`) so Admin SDK stays off the public render path.
 * Accesses Firestore only through `@repo/firebase` helpers (no direct firebase-admin import).
 * Docs are validated with Zod schemas rather than Admin converters to avoid
 * firebase-admin / web Firestore type skew on QueryDocumentSnapshot.
 */

import {
  FIRESTORE_ROOT,
  firestorePaths,
  getServerFirestore,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  publicSearchIndexSchema,
  type PublicActiveReleaseDoc,
  type PublicEntityProjectionDoc,
  type PublicSearchIndexDoc as FirestorePublicSearchIndexDoc,
} from '@repo/firebase';
import { shouldUseLivePublicProjections } from './live-policy';

export { shouldUseLivePublicProjections };

const SEARCH_INDEX_PAGE_SIZE = 400;

export async function fetchActiveRelease(): Promise<PublicActiveReleaseDoc | undefined> {
  const snap = await getServerFirestore().doc(firestorePaths.publicActiveRelease()).get();
  if (!snap.exists) return undefined;
  return parseActiveRelease(snap.data());
}

export async function fetchPublicEntityProjection(
  releaseId: string,
  entityId: string,
): Promise<PublicEntityProjectionDoc | undefined> {
  const snap = await getServerFirestore()
    .doc(firestorePaths.publicEntity(releaseId, entityId))
    .get();
  if (!snap.exists) return undefined;
  return parseEntityProjection(snap.data());
}

/**
 * Unbounded collection get — prefer release `entities.json` artifacts or
 * `unstable_cache` wrappers in `source.ts`. Kept for artifact-miss fallback.
 */
export async function listPublicEntityProjections(
  releaseId: string,
): Promise<readonly PublicEntityProjectionDoc[]> {
  const query = await getServerFirestore().collection(`publicReleases/${releaseId}/entities`).get();
  const entities: PublicEntityProjectionDoc[] = [];
  for (const doc of query.docs) {
    const parsed = parseEntityProjection(doc.data());
    if (parsed) entities.push(parsed);
  }
  return entities;
}

/**
 * Point-get a bounded set of entity projections by id (1 read per id).
 * Prefer this over `listPublicEntityProjections` for entity-page neighbor hydration.
 */
export async function fetchPublicEntityProjectionsByIds(
  releaseId: string,
  entityIds: readonly string[],
): Promise<readonly PublicEntityProjectionDoc[]> {
  const unique = [...new Set(entityIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (unique.length === 0) return [];

  const db = getServerFirestore();
  const refs = unique.map((entityId) => db.doc(firestorePaths.publicEntity(releaseId, entityId)));
  const snaps = await db.getAll(...refs);
  const entities: PublicEntityProjectionDoc[] = [];
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const parsed = parseEntityProjection(snap.data());
    if (parsed) entities.push(parsed);
  }
  return entities;
}

/**
 * Paginated read of the written `publicSearchIndex` collection for one release.
 * Prefer the release `search-index.json` artifact when available; this is the Firestore
 * fallback so search never rebuilds from a full entity projection scan.
 */
export async function listPublicSearchIndexDocs(
  releaseId: string,
): Promise<readonly FirestorePublicSearchIndexDoc[]> {
  const db = getServerFirestore();
  const collection = FIRESTORE_ROOT.publicSearchIndex;
  const docs: FirestorePublicSearchIndexDoc[] = [];
  let query = db
    .collection(collection)
    .where('releaseId', '==', releaseId)
    .orderBy('__name__')
    .limit(SEARCH_INDEX_PAGE_SIZE);

  for (;;) {
    const snap = await query.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      const parsed = parseSearchIndexDoc(doc.data());
      if (parsed) docs.push(parsed);
    }
    if (snap.size < SEARCH_INDEX_PAGE_SIZE) break;
    const last = snap.docs[snap.docs.length - 1];
    if (!last) break;
    query = db
      .collection(collection)
      .where('releaseId', '==', releaseId)
      .orderBy('__name__')
      .startAfter(last)
      .limit(SEARCH_INDEX_PAGE_SIZE);
  }
  return docs;
}

/** Validate raw docs without converter (used for diagnostics soft-fail).  */
export function parseActiveRelease(data: unknown): PublicActiveReleaseDoc | undefined {
  const parsed = publicActiveReleaseSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseEntityProjection(data: unknown): PublicEntityProjectionDoc | undefined {
  const parsed = publicEntityProjectionSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseSearchIndexDoc(data: unknown): FirestorePublicSearchIndexDoc | undefined {
  const parsed = publicSearchIndexSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}
