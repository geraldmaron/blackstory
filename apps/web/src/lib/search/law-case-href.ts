/**
 * Resolves a `/law/{slug}` href for a law/case search result, when one can be resolved
 * confidently — repo-skocy.
 *
 * `instrumentRecordHref` (`../place/place-slug.ts`) maps every `law`/`case` entity to the bare
 * string `/law`, which is correct for the map/place pipeline (a statute has no coordinate to
 * stand at) but wrong for search: a reader who searched a specific law, saw it in the results,
 * and clicked it lands on the browse index instead of the record — search found it and then
 * dropped it.
 *
 * There is no id-level join between the two catalogs. The live search index keys a law entity
 * as `ent_law_civil_rights_act_1964`; the legal snapshot catalog (`/law/{slug}`'s own source)
 * keys the same law as `legal-cra-1964`. Different systems, no shared foreign key — confirmed by
 * reading both id spaces directly rather than assumed. Deriving one id from the other by string
 * transform does not work either: `ent_case_brown_v_board_of_education_1954` would naively
 * produce `brown-v-board-of-education-1954`, but the real slug is `brown-v-board-of-education`
 * (no year), and `ent_law_13th_amendment_1865` bears no resemblance at all to its real slug
 * (`thirteenth-amendment`).
 *
 * So this resolves by an EXACT (case-insensitive, trimmed) match on the published title instead.
 * A law's title is a legal document's own name, not free text, so a same-catalog collision is
 * the kind of error this archive's own editorial process should have already caught, not one an
 * exact string match introduces. When nothing matches exactly, this returns `undefined` and the
 * caller keeps today's `/law` fallback — a genuine data-completeness gap (a search-indexable law
 * with no legal-snapshot record at all does exist; roughly half of the sampled law/case corpus
 * had none, live), not a wrong link, so a miss must fail safe to the index rather than guess.
 *
 * Cached in-process with a short TTL rather than `React.cache()`: this is a Route Handler, not
 * an RSC render, and `/search/api` is the most rate-limited, highest-traffic endpoint on the
 * site (`SEARCH_ENDPOINT_CLASS`, `expensive_read`) — every search paying for an uncached
 * `bb_public.release_legal_snapshots` read on top of its own would be the exact cost mistake
 * `atlas-catalog.ts`'s Vercel-bill history already warns against. The catalog changes only when
 * a release does, so a few minutes of staleness costs nothing a reader would notice.
 */
import { loadLegalCatalog } from '../legal/public-source';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { readonly expiresAt: number; readonly byTitle: ReadonlyMap<string, string> } | null =
  null;

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

async function lawHrefByTitle(): Promise<ReadonlyMap<string, string>> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.byTitle;

  const { snapshots } = await loadLegalCatalog();
  const byTitle = new Map<string, string>();
  for (const snapshot of snapshots) {
    // First writer wins on a title collision: an exact-match resolver has no principled way to
    // break a tie between two equally-named entries, and refusing to guess is the safer default.
    const key = normalizeTitle(snapshot.title);
    if (!byTitle.has(key)) byTitle.set(key, snapshot.slug);
  }
  cached = { expiresAt: now + CACHE_TTL_MS, byTitle };
  return byTitle;
}

/**
 * Resolves `/law/{slug}` for a `law`/`case` search result by exact title match, or `undefined`
 * when the kind isn't law/case or no exact match exists. Callers should keep their current
 * fallback (`/law`) on `undefined` rather than treat it as an error.
 */
export async function resolveLawCaseHref(result: {
  readonly kind: string;
  readonly displayName: string;
}): Promise<string | undefined> {
  if (result.kind !== 'law' && result.kind !== 'case') return undefined;
  const byTitle = await lawHrefByTitle();
  const slug = byTitle.get(normalizeTitle(result.displayName));
  return slug ? `/law/${slug}` : undefined;
}

/** Test-only: forces the next call to `resolveLawCaseHref` to rebuild the cache. */
export function resetLawCaseHrefCacheForTests(): void {
  cached = null;
}
