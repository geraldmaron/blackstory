/**
 * Enrich Lives citation lists with Wayback availability pointers (lookup only, no SPN flood).
 * Inject a lookup port (operator-cli createWaybackLookup in production scripts).
 */
import type { LivesSourceRef } from '@repo/domain/statistics/lives';

export type LivesCitationArchiveLookup = {
  findSnapshot(
    targetUrl: string,
  ): Promise<
    | { readonly status: 'found'; readonly snapshot: { readonly url: string } }
    | { readonly status: 'miss'; readonly reason?: string }
  >;
};

/** Attach archiveUrl when availability lookup finds a capture. Misses leave the live URL. */
export async function enrichLivesCitationsWithArchive(
  citations: readonly LivesSourceRef[],
  lookup: LivesCitationArchiveLookup,
): Promise<readonly LivesSourceRef[]> {
  const out: LivesSourceRef[] = [];
  for (const citation of citations) {
    if (citation.archiveUrl) {
      out.push(citation);
      continue;
    }
    const result = await lookup.findSnapshot(citation.url);
    if (result.status === 'found') {
      out.push({ ...citation, archiveUrl: result.snapshot.url });
    } else {
      out.push(citation);
    }
  }
  return out;
}
