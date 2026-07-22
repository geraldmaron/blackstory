/**
 * Correction categories and target types for the api-submissions intake route (MOB-016 / repo-zir9).
 *
 * VERBATIM mirror of the vocabulary already shipped independently by
 * `apps/web/src/app/corrections/categories.ts` and `apps/mobile/src/features/corrections/categories.ts`.
 * Each surface (web route, mobile client, submissions server) keeps its own copy rather than
 * sharing one at runtime: mobile cannot import server code (ADR-021 §4) and this server surface
 * must not import an app (`apps/web`) or grow a mobile-only shared package pre-emptively (ADR-005
 * migration trigger). The server re-validates against this authoritative copy on intake regardless
 * of what a client sent, so drift here fails a submission safely rather than smuggling an unknown
 * category through.
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
