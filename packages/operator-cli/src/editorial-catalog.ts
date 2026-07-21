/** Pure helpers for assembling the Postgres-backed editorial catalog. */
import type { EditorialCatalogEntity } from './editorial-run.js';

export const EMBEDDING_DIMS = 768;
export type EmbeddingVector = readonly number[];

export type EditorialCatalogDocument = {
  readonly id: string;
  readonly displayName?: string;
  readonly aliases?: readonly string[];
  readonly embedding?: unknown;
  readonly dims?: number;
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
  readonly embeddings: readonly EditorialCatalogDocument[];
  readonly searchIndexById: ReadonlyMap<
    string,
    { displayName?: string; aliases?: readonly string[] }
  >;
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
 * Merges an optional JSON catalog over the canonical catalog.
 * Canonical vectors win unless the JSON entry also supplies a vector.
 */
export function mergeJsonCatalogOverCanonical(
  canonicalCatalog: readonly EditorialCatalogEntity[],
  jsonCatalog: readonly EditorialCatalogEntity[],
): EditorialCatalogEntity[] {
  const byId = new Map<string, EditorialCatalogEntity>();
  for (const entry of canonicalCatalog) {
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
