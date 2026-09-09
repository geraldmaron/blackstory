/**
 * Canonical entity kind vocabulary for BlackStory.
 * Kinds map to Firestore `canonicalEntities.kind` and public projection kinds.
 *
 * `movement` is the 12th kind: a sustained, multi-actor, multi-decade phenomenon (Civil Rights
 * Movement, Great Migration, Black Power, Black Arts Movement, etc.) that individual
 * events/organizations resolve into via `part_of` — see `./movement.ts` for its field bag and
 * `./entity-status.ts` for its active|historic status vocabulary.
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
  /**
   * A technology or process a reader recognises as a thing: Latimer's carbon-manufacturing
   * process, Matzeliger's lasting machine, Morgan's three-position traffic signal, the
   * West/Sessler electret microphone.
   *
   * Deliberately NOT `artifact`, which is an object, and deliberately not defined as "a thing
   * with a patent". Patent access was unequal, enslaved people could not exercise patent
   * ownership as free citizens did, and Black inventors faced exclusion, appropriation,
   * concealed identity, employer ownership and innovation that never entered the patent system
   * at all. An invention with no patent is still an invention; the patent is a receipt, not the
   * definition. Banneker's clock is the case that keeps this honest.
   */
  'invention',
  'other',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}
