/**
 * Pure helpers for Lives citation archive pointers. Network lookup lives in ops-data
 * (lookupWaybackSnapshot); the web surface only renders archiveUrl when already attached.
 * Never invent a pointer.
 */
import type { LivesSourceRef } from '@repo/domain/statistics/lives';

/** Attach an archive pointer already verified by availability lookup. */
export function withCitationArchiveUrl(
  citation: LivesSourceRef,
  archiveUrl: string,
): LivesSourceRef {
  if (!/^https:\/\/web\.archive\.org\//u.test(archiveUrl)) {
    throw new Error('archiveUrl must be an https web.archive.org pointer');
  }
  return { ...citation, archiveUrl };
}

/** Prefer archive when present; otherwise the live URL. */
export function citationHref(citation: LivesSourceRef): {
  readonly href: string;
  readonly archived: boolean;
} {
  if (citation.archiveUrl) return { href: citation.archiveUrl, archived: true };
  return { href: citation.url, archived: false };
}
