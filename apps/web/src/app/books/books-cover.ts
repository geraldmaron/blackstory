/**
 * Open Library cover URL helpers for banned-books browse and detail surfaces.
 * Fail-closed: callers treat a missing ISBN or a load error as a typeset cover.
 */
import type { BannedBookRecord } from '@repo/domain';

export function coverIsbnForBook(book: Pick<BannedBookRecord, 'identifiers'>): string | undefined {
  const isbn13 = book.identifiers.find((entry) => entry.system === 'isbn-13');
  if (isbn13?.value.trim()) {
    return isbn13.value.trim();
  }
  const isbn10 = book.identifiers.find((entry) => entry.system === 'isbn-10');
  return isbn10?.value.trim() || undefined;
}

export function openLibraryCoverUrl(isbn: string, size: 'S' | 'M' | 'L' = 'M'): string {
  const normalized = isbn.replace(/[^0-9Xx]/g, '');
  // default=false → HTTP 404 when no cover exists (fires img onError, which swaps in the typeset cover)
  // instead of Open Library's tiny placeholder JPEG that would otherwise render blank.
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(normalized)}-${size}.jpg?default=false`;
}
