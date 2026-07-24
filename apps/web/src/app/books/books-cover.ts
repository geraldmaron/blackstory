/**
 * Open Library cover URL helpers for banned-books browse and detail surfaces.
 * Fail-closed: callers treat missing ISBN or load errors as placeholder cover art.
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
  // default=false → HTTP 404 when no cover exists (fires img onError → initials placeholder)
  // instead of Open Library's tiny placeholder JPEG that would otherwise render blank.
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(normalized)}-${size}.jpg?default=false`;
}

export function coverInitialsForTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]!.charAt(0)}${words[1]!.charAt(0)}`.toUpperCase();
}
