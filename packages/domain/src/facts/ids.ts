/**
 * Stable identity and permalink helpers for the canonical fact registry.
 *
 * Fact ids are immutable and never reused: `BB-F-######` (a zero-padded, monotonically
 * assigned 6-digit sequence never re-derived from mutable content like the statement text).
 * Public human permalinks are slug-only: `/facts/{slug}`. The immutable id stays on machine
 * surfaces (`/facts/{id}.json`, `/facts/{id}/rev/{n}`). Legacy `/facts/{id}/{slug}` paths 301
 * to the slug URL. A slug change must 301 rather than mint a new id. Per-revision
 * permalinks follow the Wikipedia "oldid" pattern: the cited revision never changes even when
 * the current record is later corrected.
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

/** Public human-facing fact URL — slug only (immutable id is not shown). */
export function buildFactPath(_id: FactId, slug: string): string {
  const trimmed = slug.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    throw new Error('fact slug must be non-empty');
  }
  return `/facts/${trimmed}`;
}

/** Legacy two-segment path kept for redirect sources only. */
export function buildLegacyFactPath(id: FactId, slug: string): string {
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
 * True when a requested URL slug no longer matches the stored canonical slug — the caller must
 * respond with a redirect to `/facts/{currentSlug}` rather than serving content at a stale slug
 * silently ("cosmetic slug 301s on change").
 */
export function slugNeedsRedirect(requestedSlug: string, currentShortStatement: string): boolean {
  return requestedSlug !== slugifyFactStatement(currentShortStatement);
}
