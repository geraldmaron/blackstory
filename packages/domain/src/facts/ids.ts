/**
 * Stable identity and permalink helpers for the canonical fact registry.
 *
 * Fact ids are immutable and never reused: `BB-F-######` (a zero-padded, monotonically
 * assigned 6-digit sequence never re-derived from mutable content like the statement text,
 * unlike the cosmetic slug below). The slug is deliberately the ONLY part of a fact's
 * permalink that may ever change: `/facts/{id}/{slug}` a slug change must 301 (see
 * `apps/web/src/app/facts/[id]/[slug]/page.tsx`) rather than mint a new id. Per-revision
 * permalinks (`/facts/{id}/rev/{n}`) follow the Wikipedia "oldid" pattern named in 
 * design note: the single most important defense against a hostile out-of-context screenshot,
 * because the cited revision never changes even when the current record is later corrected.
 */

const FACT_ID_PATTERN = /^BB-F-\d{6,}$/;

export type FactId = string & { readonly __brand: 'FactId' };

export function isFactId(value: string): value is FactId {
  return FACT_ID_PATTERN.test(value);
}

export function asFactId(value: string): FactId {
  if (!isFactId(value)) {
    throw new Error(`Invalid FactId "${value}" — expected the immutable "BB-F-######" format`);
  }
  return value as FactId;
}

/** Formats a sequence number into the canonical `BB-F-######` id string (minimum 6 digits). */
export function formatFactId(sequence: number): FactId {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error('Fact id sequence must be a positive integer');
  }
  return asFactId(`BB-F-${String(sequence).padStart(6, '0')}`);
}

/**
 * Derives the cosmetic slug from a fact's `shortStatement`. Pure and deterministic so a slug
 * recomputation (e.g. after an edit) is reproducible; the caller decides whether a changed slug
 * warrants a redirect (see `assertSlugChangeRequiresRedirect` below) — this function never
 * mutates or persists anything.
 */
export function slugifyFactStatement(shortStatement: string): string {
  const slug = shortStatement
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new Error('shortStatement must produce a non-empty slug');
  }
  return slug.length > 80 ? slug.slice(0, 80).replace(/-+$/g, '') : slug;
}

export function buildFactPath(id: FactId, slug: string): string {
  return `/facts/${id}/${slug}`;
}

export function buildFactRevisionPath(id: FactId, revisionNumber: number): string {
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    throw new Error('revisionNumber must be a positive integer');
  }
  return `/facts/${id}/rev/${revisionNumber}`;
}

/** Path for the content-negotiated CSL-JSON + extension-block representation. */
export function buildFactJsonPath(id: FactId): string {
  return `/facts/${id}.json`;
}

/**
 * True when a stored slug no longer matches the slug freshly derived from the current
 * `shortStatement` — the caller (the `/facts/{id}/{slug}` page) must respond with a redirect to
 * the current canonical path rather than serving content at a stale slug silently (:
 * "cosmetic slug 301s on change").
 */
export function slugNeedsRedirect(requestedSlug: string, currentShortStatement: string): boolean {
  return requestedSlug !== slugifyFactStatement(currentShortStatement);
}
