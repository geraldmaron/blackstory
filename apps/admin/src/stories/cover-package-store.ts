/**
 * Process-local store for article cover drafts and cover-ready packages.
 * Publication still requires the Releases desk; this store only holds the gate result.
 */
import type { CoverPackage, CoverPackageInput } from '@repo/domain';

export type StoredCoverArticle = {
  readonly slug: string;
  readonly draft: CoverPackageInput;
  readonly coverReady?: {
    readonly at: string;
    readonly cover: CoverPackage;
  };
};

const covers = new Map<string, StoredCoverArticle>();

export function getStoredCoverArticle(slug: string): StoredCoverArticle | null {
  return covers.get(slug) ?? null;
}

export function saveCoverDraft(slug: string, draft: CoverPackageInput): StoredCoverArticle {
  const current = covers.get(slug);
  const next: StoredCoverArticle = {
    slug,
    draft,
    ...(current?.coverReady ? { coverReady: current.coverReady } : {}),
  };
  covers.set(slug, next);
  return next;
}

export function markCoverReady(slug: string, cover: CoverPackage): StoredCoverArticle {
  const draft: CoverPackageInput = {
    brief: cover.brief,
    recipe: cover.recipe,
    plate: cover.plate,
    kicker: cover.kicker,
    headline: cover.headline,
  };
  const next: StoredCoverArticle = {
    slug,
    draft,
    coverReady: { at: new Date().toISOString(), cover },
  };
  covers.set(slug, next);
  return next;
}

export function listStoredCoverArticles(): readonly StoredCoverArticle[] {
  return [...covers.values()];
}

/** Test helper: clear in-memory covers. */
export function resetCoverPackageStore(): void {
  covers.clear();
}
