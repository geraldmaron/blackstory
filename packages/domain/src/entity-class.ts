/**
 * Coarse entity classification (black-book-9mox).
 *
 * `CanonicalEntity.kind` (`./entity-kinds.ts`) mixes broad classes and narrow subtypes: `school`,
 * `organization`, and `institution` overlap ambiguously (a historically Black church could
 * plausibly be filed under any of the three). `entityClass` is a small, fixed set of coarse
 * buckets that every `kind` maps onto unambiguously; `entityTypes` carries the finer, still-
 * controlled subtype label(s) that would otherwise be lost in the coarsening (e.g. `['church']`).
 *
 * Both fields are NEW and ADDITIVE — `kind` remains the canonical field every existing consumer
 * (search facets, map filters, resolution, publish gates) reads; `entityClass`/`entityTypes` are
 * derived, optional, and not wired into any of those consumers in this pass.
 */
import type { EntityKind } from './entity-kinds.js';

export const ENTITY_CLASSES = [
  'person',
  'place',
  'organization',
  'event',
  'legal',
  'work',
  'movement',
] as const;

export type EntityClass = (typeof ENTITY_CLASSES)[number];

export function isEntityClass(value: string): value is EntityClass {
  return (ENTITY_CLASSES as readonly string[]).includes(value);
}

/**
 * Controlled subtype vocabulary per coarse class. This is a starting registry, not a closed
 * list forever — new entityTypes values should be added here (and nowhere else) so the set stays
 * auditable. `organization` deliberately carries the widest vocabulary: it is the class every
 * ambiguous `kind` (school, institution) coarsens into.
 */
export const ENTITY_TYPES_BY_CLASS: Readonly<Record<EntityClass, readonly string[]>> = {
  person: ['person'],
  place: ['place', 'building', 'neighborhood', 'landmark', 'region'],
  organization: [
    'school',
    'university',
    'church',
    'business',
    'association',
    'institution',
    'organization',
  ],
  event: ['event'],
  legal: ['law', 'case'],
  work: ['publication', 'artifact'],
  movement: ['movement'],
};

export function isControlledEntityType(entityClass: EntityClass, entityType: string): boolean {
  return ENTITY_TYPES_BY_CLASS[entityClass].includes(entityType);
}

export type EntityClassification = {
  readonly entityClass: EntityClass;
  readonly entityTypes: readonly string[];
};

/**
 * Migration/derivation mapping from every CURRENT `EntityKind` value to its coarse `entityClass`
 * + a default `entityTypes` entry. Judgment calls on the ambiguous kinds:
 *
 * - `school` -> organization, entityTypes: ['school']. A school is an institution, but so is
 *   nearly everything else in this registry; folding it into `organization` (per the bead's own
 *   example: "organization: school/university/church/business/association") avoids a class that
 *   would otherwise only ever contain one kind.
 * - `institution` -> organization, entityTypes: ['institution']. `institution` as a *kind* is
 *   itself the ambiguous, catch-all label the bead is trying to resolve (it already overlaps
 *   `organization` and `school` at the kind level) — coarsening it into the same class those two
 *   land in is the whole point, rather than inventing a class that exists only to hold it.
 * - `law` / `case` -> legal (not `event`): both are static legal-status entities, not multi-actor
 *   happenings.
 * - `publication` / `artifact` -> work: both are authored/created things, distinct from the
 *   organizations or people that made them.
 * - `other` -> intentionally unmapped (returns `undefined`). None of the 7 coarse classes fit a
 *   catch-all kind by definition; silently bucketing `other` into an arbitrary class would just
 *   relocate the ambiguity problem instead of resolving it. Callers should treat `undefined` as
 *   "unclassified" and leave `entityClass`/`entityTypes` unset.
 */
const KIND_TO_CLASSIFICATION: Readonly<Partial<Record<EntityKind, EntityClassification>>> = {
  person: { entityClass: 'person', entityTypes: ['person'] },
  place: { entityClass: 'place', entityTypes: ['place'] },
  school: { entityClass: 'organization', entityTypes: ['school'] },
  organization: { entityClass: 'organization', entityTypes: ['organization'] },
  institution: { entityClass: 'organization', entityTypes: ['institution'] },
  event: { entityClass: 'event', entityTypes: ['event'] },
  law: { entityClass: 'legal', entityTypes: ['law'] },
  case: { entityClass: 'legal', entityTypes: ['case'] },
  publication: { entityClass: 'work', entityTypes: ['publication'] },
  artifact: { entityClass: 'work', entityTypes: ['artifact'] },
  movement: { entityClass: 'movement', entityTypes: ['movement'] },
};

/** Derives the default {entityClass, entityTypes} for a `kind`; `undefined` for `other` (see
 * doc comment above `KIND_TO_CLASSIFICATION`). */
export function deriveEntityClassification(kind: EntityKind): EntityClassification | undefined {
  return KIND_TO_CLASSIFICATION[kind];
}
