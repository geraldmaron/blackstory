/**
 * Correction categories and target types for the native intake form (MOB-016).
 *
 * These are a VERBATIM mirror of the web corrections vocabulary
 * (`apps/web/src/app/corrections/categories.ts`). The mobile client re-declares
 * them here because apps/mobile must not import apps/web or any server-side
 * package (ADR-021 §4 — HTTP-only, types-only-from-`@repo/public-contracts`,
 * and apps/mobile is not yet wired into the pnpm workspace, per
 * src/lib/route-params.ts's dependency note). The server re-validates the
 * category/target against its own authoritative copy on intake, so a client
 * that drifts out of sync fails validation server-side rather than smuggling an
 * unknown category through — this list is a UX affordance, not a trust boundary.
 */

export const CORRECTION_TARGET_TYPES = ['entity', 'claim', 'source', 'location'] as const;
export type CorrectionTargetType = (typeof CORRECTION_TARGET_TYPES)[number];

export const CORRECTION_CATEGORIES = [
  'factual_error',
  'missing_context',
  'source_issue',
  'location_precision',
  'living_person',
  'classification_dispute',
] as const;
export type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number];

export const CORRECTION_CATEGORY_LABELS: Readonly<Record<CorrectionCategory, string>> = {
  factual_error: 'Factual error in a published record',
  missing_context: 'Missing context or nuance',
  source_issue: 'Source link, citation, or provenance issue',
  location_precision: 'Place or geography precision issue',
  living_person: 'Living-person precision or sensitivity concern',
  classification_dispute: 'Disputed classification or framing',
};

export const CORRECTION_TARGET_LABELS: Readonly<Record<CorrectionTargetType, string>> = {
  entity: 'Entity (person, organization, place, or institution)',
  claim: 'Specific claim on a record',
  source: 'Source or citation',
  location: 'Location or geography',
};

export function isCorrectionCategory(value: unknown): value is CorrectionCategory {
  return typeof value === 'string' && (CORRECTION_CATEGORIES as readonly string[]).includes(value);
}

export function isCorrectionTargetType(value: unknown): value is CorrectionTargetType {
  return typeof value === 'string' && (CORRECTION_TARGET_TYPES as readonly string[]).includes(value);
}
