/**
 * Canonical entity kind vocabulary for Black Book (BB-014).
 * Kinds map to Firestore `canonicalEntities.kind` and public projection kinds.
 */
export const ENTITY_KINDS = [
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'other',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}
