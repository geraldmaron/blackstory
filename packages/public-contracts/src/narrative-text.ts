/**
 * Narrative text hygiene — keeping the archive's own identifiers out of reader-facing prose.
 *
 * Published narrative bodies are generated, and the generator sometimes cites the claims a
 * statement rests on by id: "In effect from 1840, ongoing as of this release. Basis:
 * plantation_arlington_antebellum_home_gardens_q4792278_claim_0, ...". That is a provenance note
 * written for the pipeline, and it renders on a record page as four lines of database key.
 *
 * The Door's first-paint surface has stripped this since it shipped. The record page did not, on
 * either platform, so the same sentence read clean on the home page and leaked on the page the
 * reader arrives at from it. The rule lives here now, where both apps can reach it.
 *
 * `stripInternalIds` keeps the sentence and drops the plumbing. `containsInternalId` is the
 * predicate for cases where the whole string is unusable and the right move is to render nothing.
 */

/** Id shapes the archive publishes: `ent_…`, `claim_…`, and their siblings. */
const INTERNAL_ID = /\b(?:ent|disc|art|pkg|rec|src|claim)_[a-z0-9_]+/gi;

/** A label that is an id and nothing else. */
const INTERNAL_LABEL = /^[a-z0-9]+(?:_[a-z0-9]+){2,}$/i;

export function containsInternalId(value: string | undefined): boolean {
  if (value === undefined) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  if (INTERNAL_LABEL.test(trimmed)) return true;
  return new RegExp(INTERNAL_ID.source, 'i').test(trimmed);
}

/**
 * Removes the pipeline's provenance tail from a narrative body, and tidies what it leaves behind.
 *
 * "ongoing as of this release" goes with it: a release is an internal publishing event, and a
 * reader has no way to know which one they are looking at.
 */
export function stripInternalIds(body: string): string {
  const stripped = body
    .replace(/\s*Basis:[^.]*\.?/gi, '')
    .replace(/\s*,?\s*ongoing as of this release\.?/gi, '')
    .replace(INTERNAL_ID, '')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\s*,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (stripped.length === 0) return stripped;
  // Removing a trailing clause takes the full stop with it. A sentence that ends mid-air reads
  // as truncated content, which is a different and worse claim than the one we removed.
  return /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
}
