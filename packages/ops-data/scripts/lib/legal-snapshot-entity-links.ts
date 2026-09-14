/**
 * Which canonical entity, if any, backs each curated legal snapshot — and, where none does, why.
 *
 * The `/law` catalog and the entity graph are separate id spaces with no foreign key between
 * them: the catalog keys the Civil Rights Act of 1964 as `legal-cra-1964`, the release keys the
 * same law as `ent_law_civil_rights_act_1964`. (`apps/web/src/lib/search/law-case-href.ts` has to
 * match on title for the same reason, and its header walks through why deriving one id from the
 * other by string transform does not work.) This map is the hand-verified join. Every non-null
 * value was read back out of `bb_public.release_entities` in the active release before it was
 * written down, and `load-legal-snapshots-to-supabase.ts` re-checks each one against the release
 * at load time, so a wrong id fails the load loudly rather than landing as a link to nothing.
 *
 * It lives here rather than inside the loader because the loader is a top-level script that opens
 * a Postgres connection on import: there was no way to assert anything about the map without also
 * running it against the database.
 *
 * ## A `null` is a ruling, not a to-do
 *
 * The seed this corpus came from pointed three slugs at `ent_seed_law_1983`,
 * `ent_seed_law_title_vii_regs` and `ent_seed_law_ga_sb202` — ids that exist in no release and
 * never did. Those were dead links dressed as coverage, which is worse than an honest blank,
 * because the surface renders "View the archive record" for anything non-empty. So the rule here
 * is: a value is either an entity id verified live in the active release, or it is `null` with the
 * reason written next to it. Nothing in between.
 *
 * Whether a law warrants a canonical entity at all is decided by
 * `docs/methodology/notability-rubric.md` §B, the ruling adopted 2026-09-09. `enacted_law` is the
 * only criterion in the ratified vocabulary that fits a `law` record:
 *
 * > The entity is a statute, constitutional amendment, executive order or ordinance whose
 * > enactment or enforcement materially changed the legal status, rights or conditions of Black
 * > Americans.
 *
 * and the rubric is explicit that "where no criterion honestly fits, the record fails the publish
 * gate instead of publishing a sentence that is false." That cuts both ways here: it rules one of
 * these three out, and it rules one of them in.
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
   * repo-5tlq. Section 1983 does not get an entity of its own, because the archive already holds
   * the statute it is: 42 U.S.C. § 1983 is Section 1 of the Act of April 20, 1871, ch. 22, 17
   * Stat. 13 — the Ku Klux Klan Act — in codified form. The snapshot's own canonical citation
   * says so, and so does the OLRC text the snapshot cites: "R.S. §1979 derived from act Apr. 20,
   * 1871, ch. 22, §1, 17 Stat. 13."
   *
   * `ent_law_ku_klux_klan_act_1871` is live in the active release and its published summary
   * already names the section: it "created a federal civil cause of action -- now 42 U.S.C.
   * Section 1983 -- for rights violations committed under state authority." A second `law` record
   * for the codified name would be the same statute entered twice under two names, which is the
   * duplicate-entity problem the merge machinery exists to clean up after — and the publisher's
   * `name_overlap` gate would not catch it, since the two names share no words.
   */
  '42-usc-1983': 'ent_law_ku_klux_klan_act_1871',

  /*
   * repo-5tlq. No entity, and this one is a decision rather than a backlog item.
   *
   * 29 C.F.R. pt. 1604 is an agency guideline issued by the EEOC under Title VII's rulemaking
   * authority (42 U.S.C. § 2000e-12). It is not a statute, a constitutional amendment, an
   * executive order or an ordinance, so `enacted_law` does not reach it, and no other ratified
   * criterion does either — it is not a judicial decision, an institution, a press or archival
   * body, or a person. Under the rubric that means it publishes no record at all rather than a
   * basis sentence that is false.
   *
   * Linking it to `ent_law_civil_rights_act_1964` instead would be worse than the blank: the
   * regulation is not the Act, and a reader who followed "View the archive record" from the
   * EEOC guidelines to the Civil Rights Act would be told these are the same thing. The snapshot
   * keeps its own catalog page, its citation and its archived capture; it just has no entity.
   */
  'title-vii-cfr-part-1604': null,

  /*
   * repo-5tlq. This one DOES warrant an entity and does not have one yet.
   *
   * A state statute that changed how Georgians vote is squarely inside `enacted_law`, and the
   * criterion is written to be neutral as to direction — the Mississippi Black Codes and the
   * Fugitive Slave Act are in the catalog for the harm they codified, exactly as the Voting
   * Rights Act is in it for what it dismantled. So "SB 202 restricts rather than extends" is a
   * reason it belongs, not a reason to leave it out.
   *
   * Publishing it is not a mapping change: it needs a landscape candidate staged with sourced
   * prose and evidence quotes, and then a run of publish-release-entities-incremental.ts, which
   * re-syncs taxonomy and related[] across the whole release and rebuilds the release graph.
   * That is a release-wide write, so it is filed as its own piece of work rather than smuggled in
   * behind a map edit. Until it lands, `null` is the honest value.
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
