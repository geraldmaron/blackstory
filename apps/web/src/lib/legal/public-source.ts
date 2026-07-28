/**
 * Legal read routing for the public `/law` surface. Reads the frozen projection in
 * bb_public.release_legal_snapshots for the active release; otherwise falls back to
 * the curated seed, mirroring apps/web/src/lib/banned-books/public-source.ts.
 *
 * The projection payload is the same document shape the seed exposes, so callers
 * get one type either way.
 */
import {
  SEED_LEGAL_SNAPSHOTS,
  getLegalCatalogEntry,
  listLegalSnapshots,
} from '../../data/legal-seed';
import { listPublicLegalSnapshots } from '../public-data/public-readers';

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

export async function loadLegalCatalog(): Promise<LegalCatalogSource> {
  try {
    const payloads = await listPublicLegalSnapshots();
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
