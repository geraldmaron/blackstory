/**
 * The closed vocabularies of a canonical entity: kind, the class it implies, and living status.
 *
 * Deliberately free of database imports. The record editor is a client component and needs these
 * lists to render its selects; importing them from the query layer would pull `pg` into the
 * browser bundle.
 *
 * `kind` and `entity_class` are not independent: every one of the 4,097 live rows follows the
 * mapping below exactly (verified against the database 2026-08-04 — `kind`/`entity_class` pairs
 * are 1:1 with no exceptions). Letting an operator set `kind` without moving `entity_class` with
 * it would create the first inconsistent row in the table, and every class facet in the workbench
 * reads `entity_class`, so the row would then be filed under its old class forever.
 *
 * Shared with bulk kind reassignment (B4), which has to apply the same derivation across a set.
 */

/**
 * `living_status` is free text whose dominant value is `not_applicable` (3,623 of 4,097 rows —
 * every place, org, and event). There is no `living` row in the table today, but the value is
 * legal and an operator may set one.
 */
export const LIVING_STATUSES = ['living', 'deceased', 'unknown', 'not_applicable'] as const;
export type LivingStatus = (typeof LIVING_STATUSES)[number];
export const ENTITY_KINDS = [
  'person',
  'place',
  'organization',
  'institution',
  'school',
  'event',
  'movement',
  'case',
  'law',
  'publication',
  'artifact',
  'other',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

const CLASS_BY_KIND: Readonly<Record<EntityKind, string | null>> = {
  person: 'person',
  place: 'place',
  organization: 'organization',
  institution: 'organization',
  school: 'organization',
  event: 'event',
  movement: 'movement',
  case: 'legal',
  law: 'legal',
  publication: 'work',
  artifact: 'work',
  // The 14 `other` rows carry no class today; inventing one would misfile them in the facets.
  other: null,
};

export function isEntityKind(value: unknown): value is EntityKind {
  return typeof value === 'string' && (ENTITY_KINDS as readonly string[]).includes(value);
}

/** The `entity_class` a kind implies, or null for kinds that intentionally carry none. */
export function entityClassForKind(kind: EntityKind): string | null {
  return CLASS_BY_KIND[kind];
}
