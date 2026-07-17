/**
 * Canonical entity kind vocabulary for Black Book (BB-014).
 * Kinds map to Firestore `canonicalEntities.kind` and public projection kinds.
 *
 * `movement` (BB-090 stress-test amendment) is the 12th kind: a sustained, multi-actor,
 * multi-decade phenomenon (Civil Rights Movement, Great Migration, Black Power, Black Arts
 * Movement, etc.) that individual events/organizations resolve into via `part_of` — see
 * ./movement.ts for its field bag and ./entity-status.ts for its active|historic status
 * vocabulary.
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
  'movement',
  'other',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}
