/**
 * Explicit mapping between legal snapshots and canonical entities. The catalogs use different
 * identifiers; the loader verifies mapped ids in the active release. Null carries an explicit
 * modeling decision or unresolved evidence need, never a fabricated destination.
 */

/**
 * Seed slug -> canonical entity id, or `null` where the ruling is that no entity backs this
 * snapshot. Keyed by `LegalSnapshot.slug`; the loader requires an entry for every seed row.
 */
export const CANONICAL_ENTITY_BY_SLUG: Record<string, string | null> = {
  'civil-rights-act-1964': 'ent_law_civil_rights_act_1964',
  'voting-rights-act-1965': 'ent_law_voting_rights_act_1965',
  'fair-housing-act-1968': 'ent_law_fair_housing_act_1968',
  'brown-v-board-of-education': 'ent_case_brown_v_board_of_education_1954',
  'shelby-county-v-holder': 'ent_case_shelby_county_v_holder_2013',
  'students-for-fair-admissions-v-harvard': 'ent_case_sffa_v_harvard_2023',
  'thirteenth-amendment': 'ent_law_13th_amendment_1865',
  'fourteenth-amendment': 'ent_law_14th_amendment_1868',
  'fifteenth-amendment': 'ent_law_15th_amendment_1870',

  /*
   * Section 1983 maps to the Ku Klux Klan Act of 1871 because it codifies that Act's section 1.
   * Retain the OLRC citation establishing the relationship rather than creating a duplicate
   * statute entity.
   */
  '42-usc-1983': 'ent_law_ku_klux_klan_act_1871',

  /*
   * The EEOC guideline retains its legal catalog page without an entity mapping under the
   * current inclusion rubric. Do not map a regulation to its enabling statute as though they
   * were identical.
   */
  'title-vii-cfr-part-1604': null,

  /*
   * SB 202 requires its own evidence-backed entity before this mapping can point to one. A
   * law's harmful effect does not exclude it from the enacted-law criterion.
   */
  'georgia-sb202-2021': null,
};

/**
 * The id namespace the retired web seed used (`ent_seed_law_1983` and friends). No release has
 * ever contained one of these, so any value under this prefix is a dead link by construction.
 */
export const DEAD_SEED_ENTITY_PREFIX = 'ent_seed_';

/**
 * The canonical entity id for a snapshot slug, or `null` when the ruling is that none backs it.
 *
 * Throws on a slug with no entry at all. A new seed row must be ruled on before it can load:
 * falling back to `null` would let an unconsidered snapshot ship as "no entity" and look
 * identical to the two deliberate blanks above.
 */
export function resolveCanonicalEntityId(slug: string): string | null {
  if (!(slug in CANONICAL_ENTITY_BY_SLUG)) {
    throw new Error(
      `slug ${slug} has no entry in CANONICAL_ENTITY_BY_SLUG — add a verified mapping (or null with its reason) before loading`,
    );
  }
  return CANONICAL_ENTITY_BY_SLUG[slug] ?? null;
}
