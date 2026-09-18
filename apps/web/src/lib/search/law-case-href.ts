/**
 * Resolves law and case search results by exact normalized title in the legal catalog. Entity
 * and legal-snapshot identifiers have no shared foreign key, so string-transformed ids are
 * unreliable. Unmatched or ambiguous titles remain unresolved.
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
