/**
 * Structured correction categories and target types for public intake. These labels are
 * stable product vocabulary they are embedded in the quarantine statement for moderators but
 * never imply automatic publication or confidence changes.
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

export function isCorrectionCategory(value: string): value is CorrectionCategory {
  return (CORRECTION_CATEGORIES as readonly string[]).includes(value);
}

export function isCorrectionTargetType(value: string): value is CorrectionTargetType {
  return (CORRECTION_TARGET_TYPES as readonly string[]).includes(value);
}
