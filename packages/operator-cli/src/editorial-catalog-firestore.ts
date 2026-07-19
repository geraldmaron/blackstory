/**
 * Loads editorial catalog entries with embedding vectors from Firestore.
 *
 * Joins `entityEmbeddings` (vectors) with `publicSearchIndex` (displayName/aliases) so
 * `editorial-run` can call related-entity suggestions without a hand-built catalog JSON.
 * Does not publish or promote — read-only catalog assembly for operator staging.
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
  EMBEDDING_DIMS,
  ENTITY_EMBEDDINGS_COLLECTION,
  VECTOR_FIELD_NAME,
  type EmbeddingVector,
} from '@repo/firebase';
import type { EditorialCatalogEntity } from './editorial-run.js';

const PAGE_SIZE = 200;

export type EditorialCatalogFirestoreDoc = {
  readonly id: string;
  readonly displayName?: string;
  readonly aliases?: readonly string[];
  readonly embedding?: unknown;
  readonly dims?: number;
};

export type LoadEditorialCatalogFromFirestoreOptions = {
  readonly expectedDims?: number;
  readonly pageSize?: number;
};

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const aliases = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  );
  return aliases.length > 0 ? aliases : undefined;
}

/** Extracts a numeric embedding vector from Admin SDK VectorValue or a plain array. */
export function extractEmbeddingVector(value: unknown): EmbeddingVector | undefined {
  if (!value) return undefined;
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'number')) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'toArray' in value) {
    const maybe = (value as { toArray?: () => unknown }).toArray;
    if (typeof maybe === 'function') {
      const array = maybe.call(value);
      if (Array.isArray(array) && array.every((entry) => typeof entry === 'number')) {
        return array;
      }
    }
  }
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const inner = (value as { value?: unknown }).value;
    if (Array.isArray(inner) && inner.every((entry) => typeof entry === 'number')) {
      return inner;
    }
  }
  return undefined;
}

/**
 * Pure merge used by tests: embeddings map + search-index metadata → catalog entities.
 * Skips docs with missing/invalid vectors or wrong dimensionality.
 */
export function mergeEditorialCatalogFromDocs(input: {
  readonly embeddings: readonly EditorialCatalogFirestoreDoc[];
  readonly searchIndexById: ReadonlyMap<string, { displayName?: string; aliases?: readonly string[] }>;
  readonly expectedDims?: number;
}): EditorialCatalogEntity[] {
  const expectedDims = input.expectedDims ?? EMBEDDING_DIMS;
  const catalog: EditorialCatalogEntity[] = [];

  for (const doc of input.embeddings) {
    const vector = extractEmbeddingVector(doc.embedding);
    if (!vector || vector.length !== expectedDims) continue;
    if (typeof doc.dims === 'number' && doc.dims !== expectedDims) continue;

    const meta = input.searchIndexById.get(doc.id);
    const displayName =
      (typeof meta?.displayName === 'string' && meta.displayName.trim()
        ? meta.displayName.trim()
        : undefined) ??
      (typeof doc.displayName === 'string' && doc.displayName.trim()
        ? doc.displayName.trim()
        : undefined) ??
      doc.id;
    const aliases = asStringArray(meta?.aliases) ?? asStringArray(doc.aliases);

    catalog.push({
      id: doc.id,
      displayName,
      vector,
      ...(aliases !== undefined ? { aliases } : {}),
    });
  }

  return catalog;
}

/**
 * Merges an optional JSON catalog over a Firestore-backed catalog.
 * Firestore vectors win unless the JSON entry also supplies a vector.
 */
export function mergeJsonCatalogOverFirestore(
  firestoreCatalog: readonly EditorialCatalogEntity[],
  jsonCatalog: readonly EditorialCatalogEntity[],
): EditorialCatalogEntity[] {
  const byId = new Map<string, EditorialCatalogEntity>();
  for (const entry of firestoreCatalog) {
    byId.set(entry.id, entry);
  }
  for (const entry of jsonCatalog) {
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      continue;
    }
    byId.set(entry.id, {
      id: entry.id,
      displayName: entry.displayName || existing.displayName,
      ...(entry.aliases !== undefined
        ? { aliases: entry.aliases }
        : existing.aliases !== undefined
          ? { aliases: existing.aliases }
          : {}),
      ...(entry.vector !== undefined
        ? { vector: entry.vector }
        : existing.vector !== undefined
          ? { vector: existing.vector }
          : {}),
    });
  }
  return [...byId.values()];
}

async function loadSearchIndexMap(
  firestore: Firestore,
  pageSize: number,
): Promise<Map<string, { displayName?: string; aliases?: readonly string[] }>> {
  const map = new Map<string, { displayName?: string; aliases?: readonly string[] }>();
  let cursor: string | undefined;
  for (;;) {
    let query = firestore.collection('publicSearchIndex').orderBy('__name__').limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const displayName =
        typeof data.displayName === 'string' ? data.displayName : undefined;
      const aliases = asStringArray(data.aliases);
      map.set(doc.id, {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(aliases !== undefined ? { aliases } : {}),
      });
    }
    const last = snapshot.docs.at(-1);
    if (!last || snapshot.docs.length < pageSize) break;
    cursor = last.id;
  }
  return map;
}

/** Pages `entityEmbeddings` and joins display metadata from `publicSearchIndex`. */
export async function loadEditorialCatalogFromFirestore(
  firestore: Firestore,
  options: LoadEditorialCatalogFromFirestoreOptions = {},
): Promise<EditorialCatalogEntity[]> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const expectedDims = options.expectedDims ?? EMBEDDING_DIMS;
  const searchIndexById = await loadSearchIndexMap(firestore, pageSize);
  const embeddings: EditorialCatalogFirestoreDoc[] = [];

  let cursor: string | undefined;
  for (;;) {
    let query = firestore
      .collection(ENTITY_EMBEDDINGS_COLLECTION)
      .orderBy('__name__')
      .limit(pageSize);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const doc of snapshot.docs) {
      const data = doc.data() as Record<string, unknown>;
      const aliases = asStringArray(data.aliases);
      embeddings.push({
        id: doc.id,
        ...(typeof data.displayName === 'string' ? { displayName: data.displayName } : {}),
        ...(aliases !== undefined ? { aliases } : {}),
        ...(data[VECTOR_FIELD_NAME] !== undefined
          ? { embedding: data[VECTOR_FIELD_NAME] }
          : {}),
        ...(typeof data.dims === 'number' ? { dims: data.dims } : {}),
      });
    }
    const last = snapshot.docs.at(-1);
    if (!last || snapshot.docs.length < pageSize) break;
    cursor = last.id;
  }

  return mergeEditorialCatalogFromDocs({
    embeddings,
    searchIndexById,
    expectedDims,
  });
}
