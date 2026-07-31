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
 *  2. Explicit override map (`MENTION_OVERRIDES`, loaded from
 *     `./data/mention-overrides.json` — repo-xez5.10 moved it out of source so curation edits
 *     don't require a code change; see that file for provenance) — a small, hand-verified table
 *     for tokens that
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
// Imported (not fs-read) so bundlers inline the data: a readFileSync on an import.meta.url-derived
// path gets compiled to the build machine's absolute path and 500s in serverless runtimes where
// that path doesn't exist.
import mentionOverridesJson from './data/mention-overrides.json' with { type: 'json' };

export type MentionResolvableEntity = {
  readonly id: string;
  readonly displayName?: string;
  readonly aliases?: readonly string[];
};

type MentionOverridesFile = {
  readonly overrides: readonly { readonly token: string; readonly entityId: string }[];
};

function loadMentionOverrides(): ReadonlyMap<string, string> {
  const parsed = mentionOverridesJson as MentionOverridesFile;
  return new Map(parsed.overrides.map((entry) => [entry.token, entry.entityId]));
}

/**
 * Hand-verified overrides for tokens seen in the national-catalog fixtures today that the
 * automated strategies cannot safely resolve alone. Loaded from
 * `./data/mention-overrides.json` (repo-xez5.10) — see that file for per-entry provenance/notes
 * and the deliberately-excluded tokens (`mfdp`, `freedom-rides`, `little-rock-nine`) that stay
 * unresolved rather than guessed.
 */
export const MENTION_OVERRIDES: ReadonlyMap<string, string> = loadMentionOverrides();

function normalizeName(value: string): string {
  return value
    // `[^()]*`, not `[^)]*`: the latter also matches '(', so a run of them backtracks.
    .replace(/\([^()]*\)/g, ' ') // drop parenthetical asides (e.g. an acronym suffix) for name matching.
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
