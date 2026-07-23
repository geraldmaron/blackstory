/**
 * Banned-books read routing for the public `/books` surface. Reads materialized snapshots
 * from `bb_public.materialized_snapshots` when available; otherwise falls back to seed data.
 */
import {
  BANNED_BOOKS_SNAPSHOT_NAME,
  validateBannedBooksListing,
  type BannedBooksListingSnapshot,
} from '@repo/domain';
import { getBannedBooksListingSnapshot } from '../../data/banned-books-seed';
import { fetchMaterializedSnapshot } from '../public-data/public-readers';

function isBannedBooksListingSnapshot(value: unknown): value is BannedBooksListingSnapshot {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as BannedBooksListingSnapshot;
  return typeof candidate.version === 'string' && Array.isArray(candidate.books);
}

export async function loadBannedBooksListing(): Promise<BannedBooksListingSnapshot> {
  try {
    const payload = await fetchMaterializedSnapshot(BANNED_BOOKS_SNAPSHOT_NAME);
    if (isBannedBooksListingSnapshot(payload)) {
      const result = validateBannedBooksListing(payload);
      if (result.ok) {
        return payload;
      }
    }
  } catch {
    // Fall back to the curated seed snapshot when postgres is unavailable or payload is invalid.
  }

  return getBannedBooksListingSnapshot();
}
