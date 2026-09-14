/**
 * Legal read routing for the public `/law` surface. Reads the frozen projection in
 * bb_public.release_legal_snapshots for the active release; otherwise falls back to
 * the curated seed, mirroring apps/web/src/lib/banned-books/public-source.ts.
 *
 * The projection payload is the same document shape the seed exposes, so callers
 * get one type either way.
 */
import { cache } from 'react';
import { getLegalCatalogEntry, listLegalSnapshots } from '../../data/legal-seed';
import type { SEED_LEGAL_SNAPSHOTS } from '../../data/legal-seed';
import { listPublicLegalSnapshots as fetchReleaseLegalSnapshots } from '../public-data/public-readers';
import { createReleaseScopedCache } from '../public-data/release-scoped-cache';
import { getPublicActiveReleaseMeta } from '../public-data/source';

export type LegalSnapshotDocument = (typeof SEED_LEGAL_SNAPSHOTS)[number];

export type LegalCatalogSource = {
  readonly snapshots: readonly LegalSnapshotDocument[];
  /** Explainer for a snapshot id, or undefined when the document carries none. */
  readonly explainerFor: (
    snapshotId: string,
  ) => NonNullable<ReturnType<typeof getLegalCatalogEntry>>['explainer'] | undefined;
};

/** Seed-backed source. Also the fixture for tests that must not touch postgres. */
export function seedLegalCatalog(): LegalCatalogSource {
  return {
    snapshots: listLegalSnapshots(),
    explainerFor: (snapshotId) => getLegalCatalogEntry(snapshotId)?.explainer,
  };
}

function isSnapshotDocument(value: unknown): value is LegalSnapshotDocument {
  if (value === null || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.slug === 'string' &&
    typeof row.title === 'string' &&
    row.citation !== null &&
    typeof row.citation === 'object'
  );
}

type ExplainerOf = ReturnType<LegalCatalogSource['explainerFor']>;

const releaseLegalSnapshotsCache = createReleaseScopedCache<readonly unknown[]>({
  kind: 'release-legal-snapshots-v1',
});

/**
 * Every frozen legal snapshot in the active release (~12 rows, ~27KB), read once per
 * release-scoped cache window and shared across requests — mirrors the entities/search-index
 * pattern in public-data/source.ts. Before this, `/law` read bb_public.release_legal_snapshots
 * on every request: 22,532 calls between 2026-07-20 and 2026-09-12 with no cross-request cache.
 */
const listReleaseLegalSnapshotsCached = cache(async (): Promise<readonly unknown[]> => {
  const release = await getPublicActiveReleaseMeta();
  if (!release) return fetchReleaseLegalSnapshots();
  return (await releaseLegalSnapshotsCache.get(release, fetchReleaseLegalSnapshots)) ?? [];
});

export async function loadLegalCatalog(): Promise<LegalCatalogSource> {
  try {
    const payloads = await listReleaseLegalSnapshotsCached();
    const snapshots = payloads.filter(isSnapshotDocument);
    if (snapshots.length > 0) {
      const explainers = new Map<string, ExplainerOf>();
      for (const snapshot of snapshots) {
        const explainer = (snapshot as { explainer?: ExplainerOf }).explainer;
        if (explainer) explainers.set(snapshot.id, explainer);
      }
      return {
        snapshots,
        explainerFor: (snapshotId) => explainers.get(snapshotId),
      };
    }
  } catch {
    // Fall back to the curated seed when postgres is unavailable or the payload is invalid.
  }
  return seedLegalCatalog();
}
