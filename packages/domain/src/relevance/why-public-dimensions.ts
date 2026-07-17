/**
 * BB-054 story-composition dimension taxonomy — the "balance" half of the public "why this
 * appears" surface (BB-054 Deliver #2: balancing harm, achievement, joy, family, community,
 * institution-building, resistance, culture, and everyday life). This module classifies already
 * ACCEPTED evidence/claim prose (BB-040 relevance evidence, ./why.ts; BB-052 historicalContext-
 * style claim text) into the nine dimensions below by deterministic keyword matching — it invents
 * no new evidence, assigns no numeric weight per dimension, and records presence/absence only.
 *
 * `isViolenceOnlyCollapse` and `assertResultsNotViolenceOnlyCollapse` compose this classification
 * into BB-054 acceptance criterion 3 ("results do not collapse Black history into violence-only
 * content"): a SINGLE entity may legitimately classify as harm-only when that is the honest state
 * of its accepted evidence (a massacre site has no obligation to invent an unrelated joy claim) —
 * the AC's plural "results" wording is enforced at the result-SET level by the assert below, which
 * ./why-public-missing-perspective.ts's per-entity indicator softens further by naming the gap
 * honestly rather than silently narrowing the record.
 */

export const STORY_DIMENSIONS = [
  'harm',
  'achievement',
  'joy',
  'family',
  'community',
  'institution_building',
  'resistance',
  'culture',
  'everyday_life',
] as const;

export type StoryDimension = (typeof STORY_DIMENSIONS)[number];

/** Approved-language labels for each dimension — never a raw enum token in public copy. */
export const STORY_DIMENSION_LABELS: Readonly<Record<StoryDimension, string>> = {
  harm: 'Documented harm',
  achievement: 'Achievement',
  joy: 'Joy',
  family: 'Family',
  community: 'Community',
  institution_building: 'Institution-building',
  resistance: 'Resistance',
  culture: 'Culture',
  everyday_life: 'Everyday life',
};

/**
 * Deterministic keyword sets per dimension. Non-exhaustive by design (this is a coarse editorial
 * classifier, not an NLP model) — false negatives (missing a dimension that is present) are safe,
 * since the composer treats absence as "not yet documented" rather than "does not exist" (see
 * ./why-public-missing-perspective.ts). Lowercase, matched as substrings against lowercased text.
 */
const STORY_DIMENSION_KEYWORDS: Readonly<Record<StoryDimension, readonly string[]>> = {
  harm: [
    'lynch', 'murder', 'killed', 'massacre', 'violence', 'assault', 'beaten', 'enslaved',
    'enslavement', 'segregat', 'discriminat', 'persecut', 'terroriz', 'raid', 'burned down',
    'displac', 'exclusion', 'brutal',
  ],
  achievement: [
    'first to', 'first black', 'award', 'honor', 'hall of fame', 'medal', 'record-setting',
    'pioneer', 'graduated', 'elected', 'appointed', 'founded', 'patent', 'degree', 'championship',
  ],
  joy: [
    'celebrat', 'joy', 'festival', 'wedding', 'reunion', 'homecoming', 'music', 'dance', 'parade',
    'laughter', 'gather', 'jubilee',
  ],
  family: [
    'family', 'daughter', 'son', 'mother', 'father', 'grandmother', 'grandfather', 'household',
    'descendant', 'kinship', 'siblings',
  ],
  community: [
    'community', 'neighbor', 'mutual aid', 'congregation', 'fraternal', 'lodge', 'block club',
    'anchor institution', 'local residents',
  ],
  institution_building: [
    'founded', 'chartered', 'incorporated', 'established', 'built the', 'organized the',
    'headquarters', 'campus', 'institution', 'society', 'association',
  ],
  resistance: [
    'protest', 'boycott', 'sit-in', 'organiz', 'movement', 'strike', 'petition', 'march on',
    'resist', 'civil rights', 'union', 'advocacy',
  ],
  culture: [
    'music', 'art', 'literature', 'poet', 'novel', 'painting', 'theater', 'film', 'cuisine',
    'fashion', 'folklore', 'tradition',
  ],
  everyday_life: [
    'daily life', 'worked as', 'business owner', 'shop', 'farmed', 'commut', 'neighborhood life',
    'ordinary', 'routine',
  ],
};

/** Classifies free-text prose into the story dimensions it evidences, deduped and returned in
 * canonical `STORY_DIMENSIONS` order (never input order, so downstream rendering is stable). */
export function classifyStoryDimensions(texts: readonly string[]): readonly StoryDimension[] {
  const haystack = texts.join(' ').toLowerCase();
  if (!haystack.trim()) return [];
  return STORY_DIMENSIONS.filter((dimension) =>
    STORY_DIMENSION_KEYWORDS[dimension].some((keyword) => haystack.includes(keyword)),
  );
}

/** True only when `harm` is the SOLE classified dimension — never true for an entity with no
 * classified dimensions at all (that is a coverage gap, not a violence-only collapse). */
export function isViolenceOnlyCollapse(dimensions: readonly StoryDimension[]): boolean {
  return dimensions.length === 1 && dimensions[0] === 'harm';
}

/**
 * BB-054 acceptance criterion 3, enforced at the result-SET level ("results do not collapse...").
 * Throws only when every harm-classified entity in the provided set is itself harm-only AND the
 * set contains at least one harm-classified entity — i.e. the visible result set reads as wall-
 * to-wall violence with no counterbalancing dimension anywhere in it. A set that mixes a harm-only
 * entity with other, more balanced entities passes.
 */
export function assertResultsNotViolenceOnlyCollapse(
  perEntityDimensions: readonly (readonly StoryDimension[])[],
): void {
  const harmClassified = perEntityDimensions.filter((dimensions) => dimensions.includes('harm'));
  if (harmClassified.length === 0) return;
  const allCollapsed = harmClassified.every(isViolenceOnlyCollapse);
  if (allCollapsed && harmClassified.length === perEntityDimensions.length) {
    throw new Error(
      'Result set collapses Black history into violence-only content — every entity classifies ' +
        'as harm-only with no achievement, joy, family, community, institution-building, ' +
        'resistance, culture, or everyday-life connection documented anywhere in the set.',
    );
  }
}
