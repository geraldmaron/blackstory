/**
 * The one relationship vocabulary.
 *
 * `RELATIONSHIP_TYPES` is the write-side list: every value in it carries documented direction and
 * temporal semantics in `RELATIONSHIP_TYPE_SEMANTICS`
 * (packages/domain-core/src/relationship.ts), which re-exports this array instead of restating it.
 * `LEGACY_DB_RELATIONSHIP_TYPES` holds five predicates the database still admits but nothing
 * writes as a graph edge. `DB_RELATIONSHIP_TYPES` is the union of the two and is exactly the value
 * set of the `entity_relationships_relationship_type_check` CHECK constraint; the read-side gate
 * below accepts that union, because it is precisely what a stored row can contain.
 *
 * `relationship-vocabulary.test.ts` parses the constraint out of
 * `supabase/migrations/20260908120000_invention_kind_and_contribution_predicates.sql` and fails
 * when the database and this file disagree, so drift between the two is a CI failure rather than
 * a production one.
 *
 * This module imports zod and nothing else — no product constitution, no Node builtins — so
 * browser-facing packages can depend on the vocabulary without pulling in the constitution loader.
 */
import { z } from 'zod';

export const RELATIONSHIP_TYPES = [
  'located_at',
  'occurred_at',
  'attended',
  'founded',
  'employed_by',
  'member_of',
  'related_to',
  'depicts',
  'cites',
  'governed_by',
  'part_of',
  'successor_of',
  // historical-causation edges.
  'caused',
  'enabled',
  'influenced',
  'participated_in',
  'overturned',
  'commemorates',
  // Creation attribution, distinct from `founded` (orgs/institutions only).
  'authored',
  // Invention contribution. The whole reason these are separate edges rather than one
  // `contributed_to` with a note is that "Lewis Latimer invented the light bulb" and "Lewis
  // Latimer developed and patented an improved process for manufacturing carbon conductors used
  // in incandescent lamps" must not be the same row with different prose. `invented` and
  // `co_invented` are high-impact and carry the corroboration gate; `improved`, `developed` and
  // `designed` are the bounded edges most inventor records should actually be using.
  'invented',
  'co_invented',
  'improved',
  'developed',
  'designed',
  'led_development_of',
  'built_on',
  // Commercial and institutional context around an invention.
  'commercialized',
  'assigned_to',
  'licensed_to',
  'manufactured_by',
  'demonstrated_at',
  // Human network around the work. `documented_by` is how a compiler such as Henry E. Baker
  // relates to the inventors he recorded, which is a historical relationship in its own right.
  'collaborated_with',
  'mentored_by',
  'litigated_with',
  'documented_by',
  'other',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/**
 * Predicates the `entity_relationships_relationship_type_check` constraint still admits, inherited
 * from the `entity_relationships_typed_predicate` constraint it replaced, that are deliberately
 * not part of the write-side vocabulary:
 *
 * - no live row uses one (the migration measured 0 of 1,064 rows);
 * - none has a `RELATIONSHIP_TYPE_SEMANTICS` entry, so an edge typed with one has no documented
 *   direction, no temporal rule and no causal guardrail;
 * - the names are real elsewhere as *claim* predicates (`bb_research.claim_versions.predicate`,
 *   the discovery query packs in docs/research/network-traversal-discovery.md), which is a
 *   different vocabulary that happens to share spellings.
 *
 * They stay listed here so the read side accepts every value the database can physically hold and
 * so the constraint-parity test can compare exact sets. Promote a value into `RELATIONSHIP_TYPES`
 * only alongside a semantics entry describing what the edge means.
 */
export const LEGACY_DB_RELATIONSHIP_TYPES = [
  'served_as',
  'succeeded',
  'challenged_law',
  'funded_by',
  'published',
] as const;

export type LegacyDbRelationshipType = (typeof LEGACY_DB_RELATIONSHIP_TYPES)[number];

/** Every value a stored `relationship_type` can hold: the CHECK constraint, as TypeScript. */
export const DB_RELATIONSHIP_TYPES = [
  ...RELATIONSHIP_TYPES,
  ...LEGACY_DB_RELATIONSHIP_TYPES,
] as const;

export type DbRelationshipType = (typeof DB_RELATIONSHIP_TYPES)[number];

/**
 * Read-side gate for a stored relationship type.
 *
 * Unknown values degrade to `other` with a warning naming the value, rather than failing the
 * parse: a projection that fails to parse does not degrade, it 404s. On 2026-09-09 a narrower
 * copy of this enum unpublished 39 live records for exactly that reason. The warning is what makes
 * the degradation visible — an unknown type means this list is behind the database, and the fix is
 * to add the value here.
 */
export const relationshipTypeSchema = z.enum(DB_RELATIONSHIP_TYPES).catch((ctx) => {
  console.warn(
    `[relationship-vocabulary] unknown relationship type ${JSON.stringify(ctx.input)}; ` +
      'reading it as "other". Add it to @repo/schemas relationship-vocabulary.ts.',
  );
  return 'other';
});
