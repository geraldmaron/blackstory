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
  getSeedStoryProjection,
  listSeedStoryProjections,
  publicActiveReleaseSchema,
  publicEntityProjectionSchema,
  publicSearchIndexSchema,
  publicStoryListItemSchema,
  publicStoryProjectionSchema,
  type PublicActiveReleaseDoc,
  type PublicEntityProjectionDoc,
  type PublicSearchIndexDoc as FirestorePublicSearchIndexDoc,
  type PublicStoryListItemDoc,
  type PublicStoryProjectionDoc,
} from '@repo/firebase';
import { shouldUseLivePublicProjections } from './live-policy';

export { shouldUseLivePublicProjections };

const SEARCH_INDEX_PAGE_SIZE = 400;

/**
 * Firestore Admin `getAll` / batchGet caps refs per RPC (commonly 100). Chunk above this
 * so mosaic rails and dense neighbor sets do not fail or silently truncate.
 */
export const FIRESTORE_GET_ALL_CHUNK_SIZE = 100;

/** Fields needed for `/stories` index cards — excludes body prose and related ids. */
const STORY_LIST_SELECT_FIELDS = [
  'id',
  'releaseId',
  'slug',
  'title',
  'dek',
  'publishedAt',
  'eraLabel',
  'placeLabel',
] as const;

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
 * Unbounded collection get — prefer release `entities.json` artifacts or the
 * size-gated catalog cache in `source.ts` (process TTL + Next data cache when
 * under 2MB). Kept for artifact-miss fallback.
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
 * Prefer this over `listPublicEntityProjections` for entity-page neighbor hydration
 * and thin card rails (`listPublicEntityViewsByIds`). Chunks `getAll` at
 * {@link FIRESTORE_GET_ALL_CHUNK_SIZE}.
 */
export async function fetchPublicEntityProjectionsByIds(
  releaseId: string,
  entityIds: readonly string[],
): Promise<readonly PublicEntityProjectionDoc[]> {
  const unique = [...new Set(entityIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (unique.length === 0) return [];

  const db = getServerFirestore();
  const refs = unique.map((entityId) => db.doc(firestorePaths.publicEntity(releaseId, entityId)));
  const entities: PublicEntityProjectionDoc[] = [];
  for (let offset = 0; offset < refs.length; offset += FIRESTORE_GET_ALL_CHUNK_SIZE) {
    const chunk = refs.slice(offset, offset + FIRESTORE_GET_ALL_CHUNK_SIZE);
    const snaps = await db.getAll(...chunk);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const parsed = parseEntityProjection(snap.data());
      if (parsed) entities.push(parsed);
    }
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

export function parseStoryProjection(data: unknown): PublicStoryProjectionDoc | undefined {
  const parsed = publicStoryProjectionSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export function parseStoryListItem(data: unknown): PublicStoryListItemDoc | undefined {
  const parsed = publicStoryListItemSchema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

export async function fetchPublicStoryProjection(
  releaseId: string,
  slug: string,
): Promise<PublicStoryProjectionDoc | undefined> {
  const snap = await getServerFirestore().doc(firestorePaths.publicStory(releaseId, slug)).get();
  if (!snap.exists) return undefined;
  return parseStoryProjection(snap.data());
}

/** Unbounded collection get for a release's longform stories (Admin SDK). Full docs. */
export async function listPublicStoryProjections(
  releaseId: string,
): Promise<readonly PublicStoryProjectionDoc[]> {
  const query = await getServerFirestore().collection(`publicReleases/${releaseId}/stories`).get();
  const stories: PublicStoryProjectionDoc[] = [];
  for (const doc of query.docs) {
    const parsed = parseStoryProjection(doc.data());
    if (parsed) stories.push(parsed);
  }
  return stories;
}

/**
 * Field-masked story list for `/stories` index cards. Omits `body` and `relatedEntityIds`
 * so list TTFB and caches stay small relative to full article docs.
 */
export async function listPublicStorySummaries(
  releaseId: string,
): Promise<readonly PublicStoryListItemDoc[]> {
  const query = await getServerFirestore()
    .collection(`publicReleases/${releaseId}/stories`)
    .select(...STORY_LIST_SELECT_FIELDS)
    .get();
  const stories: PublicStoryListItemDoc[] = [];
  for (const doc of query.docs) {
    const parsed = parseStoryListItem(doc.data());
    if (parsed) stories.push(parsed);
  }
  return stories;
}

/** Map a full story projection to the list-card shape (seed / offline path). */
export function toStoryListItem(story: PublicStoryProjectionDoc): PublicStoryListItemDoc {
  return {
    id: story.id,
    releaseId: story.releaseId,
    slug: story.slug,
    title: story.title,
    dek: story.dek,
    publishedAt: story.publishedAt,
    eraLabel: story.eraLabel,
    placeLabel: story.placeLabel,
  };
}

/** Offline / seed-mode story list: same corpus written into Firestore fixtures. */
export function listSnapshotStoryProjections(): readonly PublicStoryProjectionDoc[] {
  return listSeedStoryProjections();
}

export function listSnapshotStoryListItems(): readonly PublicStoryListItemDoc[] {
  return listSeedStoryProjections().map(toStoryListItem);
}

export function getSnapshotStoryProjection(slug: string): PublicStoryProjectionDoc | undefined {
  return getSeedStoryProjection(slug);
}
