/**
 * Semantic near-duplicate detection over embeddings a recall safety net that
 * complements the exact content-hash dedup in ../discovery/deduplication.ts.
 *
 * Content-hash dedup catches byte-identical re-syndication. It cannot catch two write-ups of
 * the same underlying fact that differ in wording. This module flags *semantically* close
 * candidates so weak-signal items surface for human corroboration instead of silently
 * duplicating research effort it never merges or discards anything itself. Per 
 * (../discovery/guard.ts), discovery must never publish or merge on its own authority; that
 * stays true here by construction every function below is a pure read-only comparison.
 */
import { cosineSimilarity, type EmbeddingVector } from './vector-math.js';

export type NearDuplicateItem = {
  readonly id: string;
  readonly vector: EmbeddingVector;
};

export type NearDuplicateFlag = {
  readonly id: string;
  readonly similarity: number;
};

/** Default threshold: near-duplicate flagging is intentionally more permissive than exact match. */
export const DEFAULT_NEAR_DUPLICATE_THRESHOLD = 0.92;

/**
 * Compares one candidate against a set of already-known items (e.g. existing discovery
 * candidates or accepted claims) and returns every item whose cosine similarity meets the
 * threshold, most-similar first. Intended call site: discovery ingestion, right after exact
 * content-hash dedup see ../discovery/deduplication.ts.
 */
export function findNearDuplicatesOf(
  candidate: NearDuplicateItem,
  existing: readonly NearDuplicateItem[],
  threshold: number = DEFAULT_NEAR_DUPLICATE_THRESHOLD,
): readonly NearDuplicateFlag[] {
  if (threshold < -1 || threshold > 1) {
    throw new Error('findNearDuplicatesOf: threshold must be within [-1, 1]');
  }

  const flags: NearDuplicateFlag[] = [];
  for (const other of existing) {
    if (other.id === candidate.id) continue;
    const similarity = cosineSimilarity(candidate.vector, other.vector);
    if (similarity >= threshold) {
      flags.push({ id: other.id, similarity });
    }
  }
  flags.sort((a, b) => b.similarity - a.similarity);
  return flags;
}

export type NearDuplicateCluster = {
  readonly memberIds: readonly string[];
};

/**
 * Groups a batch of items into near-duplicate clusters via union-find over the threshold graph
 * (pairwise similarity >= threshold). Useful for periodic corpus-wide sweeps rather than
 * per-item ingestion checks. Singletons (no match above threshold) are omitted callers only
 * get clusters that actually need a human look.
 */
export function clusterNearDuplicates(
  items: readonly NearDuplicateItem[],
  threshold: number = DEFAULT_NEAR_DUPLICATE_THRESHOLD,
): readonly NearDuplicateCluster[] {
  const parent = new Map<string, string>();
  for (const item of items) parent.set(item.id, item.id);

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    let cursor = id;
    while (parent.get(cursor) !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const similarity = cosineSimilarity(items[i]!.vector, items[j]!.vector);
      if (similarity >= threshold) {
        union(items[i]!.id, items[j]!.id);
      }
    }
  }

  const groups = new Map<string, string[]>();
  for (const item of items) {
    const root = find(item.id);
    const members = groups.get(root) ?? [];
    members.push(item.id);
    groups.set(root, members);
  }

  return Array.from(groups.values())
    .filter((members) => members.length > 1)
    .map((memberIds) => ({ memberIds }));
}
