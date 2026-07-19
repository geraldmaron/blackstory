/**
 * Resolves a catalog entity's `mentionedEntityIds` tokens — currently a mixed bag of already
 * -canonical entity ids (`ent_carter_g_woodson_001`), bare acronyms (`sclc`, `naacp`), and
 * event/campaign slugs (`montgomery-bus-boycott`) — into canonical entity ids from the SAME
 * catalog entity set. See `../taxonomy/topics.ts`'s `ORGANIZATION_SHAPED_LEGACY_TAGS` /
 * `EVENT_OR_LAW_SHAPED_LEGACY_TAGS` for how these tokens got into `mentionedEntityIds` in the
 * first place (a migration that deliberately deferred real resolution to this module — see that
 * file's and `../publication/release-builder.ts`'s header comments).
 *
 * Resolution never guesses: a token resolves only when exactly one candidate is confidently
 * identified. Ambiguous matches (e.g. an acronym shared by an organization AND its own "founding"
 * event entity) return `undefined` rather than picking a side.
 *
 * Match strategies, in precedence order:
 *  1. Direct id hit — the token IS already a canonical entity id present in the set.
 *  2. Explicit override map (`MENTION_OVERRIDES`) — a small, hand-verified table for tokens that
 *     are unambiguous to a human researcher but not safely disambiguable by the automated
 *     strategies below (either because the normalized name doesn't literally match the token, or
 *     because the acronym is shared by more than one entity in the catalog). Checked before the
 *     automated strategies specifically so those ambiguous-acronym cases never fall through to a
 *     guess.
 *  3. Normalized displayName equality — token normalizes to the exact same string as the
 *     entity's displayName (punctuation/case/hyphen-insensitive).
 *  4. Alias match — same normalization against each of the entity's `aliases`, when present.
 *     (No catalog fixture populates `aliases` today; this exists for when one does.)
 *  5. Acronym-in-parentheses — the entity's displayName carries a "(ACRONYM)" suffix (e.g.
 *     "Southern Christian Leadership Conference (SCLC)") whose lowercased acronym matches the
 *     token, AND exactly one entity in the set carries that acronym.
 */

export type MentionResolvableEntity = {
  readonly id: string;
  readonly displayName?: string;
  readonly aliases?: readonly string[];
};

/**
 * Hand-verified overrides for tokens seen in the national-catalog fixtures today that the
 * automated strategies cannot safely resolve alone:
 *  - the five organization acronyms below each collide with that org's own "Founding" event
 *    entity (also carrying "(ACRONYM)" in its displayName), so the acronym-in-parentheses
 *    strategy alone is ambiguous between the org and the founding event; the override always
 *    prefers the organization.
 *  - `civil-rights-act-1866` / `freedom-summer` / `selma` are slugs whose normalized form does
 *    not literally equal the target entity's displayName (extra words like "of" or a longer,
 *    more specific title), but each has exactly one unambiguous referent in the catalog.
 *
 * Deliberately NOT included: `mfdp` (no standalone Mississippi Freedom Democratic Party
 * *organization* entity exists — only `ent_mfdp_dnc_challenge_001`, a specific 1964 DNC-challenge
 * *event* — mapping the bare organization mention to that one event would overclaim), and
 * `freedom-rides` / `little-rock-nine` (no matching event entity exists in the catalog at all,
 * only e.g. `ent_freedom_rides_museum_001`, a distinct memorial-site entity). These remain
 * unresolved rather than guessed; add an override once/if a real target entity is added.
 */
export const MENTION_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ['naacp', 'ent_naacp_org_001'],
  ['sclc', 'ent_sclc_org_001'],
  ['sncc', 'ent_sncc_org_001'],
  ['core', 'ent_core_org_001'],
  ['cofo', 'ent_cofo_001'],
  ['civil-rights-act-1866', 'ent_law_civil_rights_act_1866'],
  ['freedom-summer', 'ent_freedom_summer_mount_zion_001'],
  ['selma', 'ent_selma_to_montgomery_marches_001'],
]);

function normalizeName(value: string): string {
  return value
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical asides (e.g. an acronym suffix) for name matching.
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Extracts a lowercased "(ACRONYM)" parenthetical from anywhere in a displayName, if present.
 * Requires the parenthetical to be ALL-UPPERCASE letters/digits — real acronyms in this catalog
 * (SCLC, SNCC, CORE, NAACP, COFO) are always styled this way, whereas mixed-case parentheticals
 * like "(Bob)" (a nickname, see `ent_robert_moses_001`) or "(Old Site)" are not acronyms and must
 * never be mistaken for one. Not anchored to the end of the string: several catalog entries carry
 * "(ACRONYM) Founding" / "(ACRONYM) Founding Conference" suffixes, and those founding-event
 * entities are exactly the source of the acronym ambiguity `MENTION_OVERRIDES` exists to resolve.
 */
function acronymFromDisplayName(displayName: string): string | undefined {
  const match = displayName.match(/\(([A-Z0-9]{2,8})\)/);
  return match?.[1]?.toLowerCase();
}

export type MentionResolverIndex = {
  readonly byId: ReadonlyMap<string, MentionResolvableEntity>;
  readonly byNormalizedName: ReadonlyMap<string, readonly string[]>;
  readonly byAcronym: ReadonlyMap<string, readonly string[]>;
};

/** Builds a reusable lookup index once per entity set — callers resolving many tokens against
 * the same catalog (e.g. one extraction pass over hundreds of entities) should build this once
 * rather than re-scanning the entity list per token. */
export function buildMentionResolverIndex(
  entities: readonly MentionResolvableEntity[],
): MentionResolverIndex {
  const byId = new Map<string, MentionResolvableEntity>();
  const byNormalizedName = new Map<string, string[]>();
  const byAcronym = new Map<string, string[]>();

  const addName = (key: string, id: string): void => {
    const existing = byNormalizedName.get(key);
    if (existing) existing.push(id);
    else byNormalizedName.set(key, [id]);
  };
  const addAcronym = (key: string, id: string): void => {
    const existing = byAcronym.get(key);
    if (existing) existing.push(id);
    else byAcronym.set(key, [id]);
  };

  for (const entity of entities) {
    byId.set(entity.id, entity);

    if (entity.displayName) {
      const normalizedName = normalizeName(entity.displayName);
      if (normalizedName) addName(normalizedName, entity.id);

      const acronym = acronymFromDisplayName(entity.displayName);
      if (acronym) addAcronym(acronym, entity.id);
    }

    for (const alias of entity.aliases ?? []) {
      const normalizedAlias = normalizeName(alias);
      if (normalizedAlias) addName(normalizedAlias, entity.id);
    }
  }

  return { byId, byNormalizedName, byAcronym };
}

/** Returns the sole candidate id, or `undefined` when the key is absent or ambiguous (more than
 * one candidate) — resolution never guesses between multiple matches. */
function soleCandidate(candidates: readonly string[] | undefined): string | undefined {
  if (!candidates || candidates.length !== 1) return undefined;
  return candidates[0];
}

/**
 * Resolves one mention token to a canonical entity id present in `index`, or `undefined` when no
 * strategy confidently identifies exactly one target. Pure function of the token + index; never
 * mutates either.
 */
export function resolveMentionToken(
  token: string,
  index: MentionResolverIndex,
): string | undefined {
  const trimmed = token.trim();
  if (!trimmed) return undefined;

  // 1. Direct id hit: the token is already a canonical entity id in this set.
  if (index.byId.has(trimmed)) return trimmed;

  const normalizedToken = normalizeToken(trimmed);

  // 2. Explicit override map, restricted to targets that actually exist in this entity set.
  const override = MENTION_OVERRIDES.get(normalizedToken);
  if (override && index.byId.has(override)) return override;

  // 3. Normalized displayName equality.
  const normalizedNameKey = normalizeName(trimmed);
  const nameMatch = soleCandidate(index.byNormalizedName.get(normalizedNameKey));
  if (nameMatch) return nameMatch;

  // 4/5. Acronym-in-parentheses (aliases are folded into `byNormalizedName` above, so step 3
  // already covers alias matches).
  const acronymMatch = soleCandidate(index.byAcronym.get(normalizedToken));
  if (acronymMatch) return acronymMatch;

  return undefined;
}
