/**
 * Canonical race/ethnicity slices for `bb_reference.statistical_observations`.
 *
 * Live rows carry at least eleven spellings (`black`, `black_alone`, `black_nonhispanic`,
 * `white_nh`, `white_nonhispanic`, `white-non-hispanic`, `white`, `white_alone`, `hispanic`,
 * `asian`, `nonwhite`, plus null). Some of those are spelling variants of one definition and
 * some are genuinely different definitions, and the difference matters: `black_alone` includes
 * Hispanic Black people and `black_nh` does not, which moves figures most in New York, Miami
 * and Houston. The normalizer below merges only spellings that mean the same thing. It never
 * turns a race-only slice into a non-Hispanic one.
 *
 * Lives Across the Decades uses the three non-overlapping groups in `LIVES_GROUP_SLICES`
 * (docs/methodology/lives-across-decades.md).
 */

export const CANONICAL_RACE_ETHNICITY_SLICES = [
  /** Every person in the universe. Stored as a null slice. */
  'all',
  /** Black, not Hispanic. */
  'black_nh',
  /** White, not Hispanic. */
  'white_nh',
  /** Hispanic or Latino origin, any race. */
  'hispanic',
  /** Black alone (one race), Hispanic origin not excluded. Post-2000 multi-race regime. */
  'black_alone',
  /** White alone (one race), Hispanic origin not excluded. */
  'white_alone',
  /** Black as the source defined it, without a Hispanic split or an alone/combination split. */
  'black',
  /** White as the source defined it, without a Hispanic split or an alone/combination split. */
  'white',
  'asian',
  'nonwhite',
] as const;

export type CanonicalRaceEthnicitySlice = (typeof CANONICAL_RACE_ETHNICITY_SLICES)[number];

const LEGACY_SPELLINGS: Readonly<Record<string, CanonicalRaceEthnicitySlice>> = {
  all: 'all',
  black_nh: 'black_nh',
  black_nonhispanic: 'black_nh',
  'black-non-hispanic': 'black_nh',
  white_nh: 'white_nh',
  white_nonhispanic: 'white_nh',
  'white-non-hispanic': 'white_nh',
  hispanic: 'hispanic',
  latino: 'hispanic',
  hispanic_any_race: 'hispanic',
  black_alone: 'black_alone',
  white_alone: 'white_alone',
  black: 'black',
  white: 'white',
  asian: 'asian',
  nonwhite: 'nonwhite',
};

/**
 * Maps a stored slice to its canonical form. A null or empty slice is `all`. An unrecognized
 * spelling returns null so the caller decides, rather than guessing a definition.
 */
export function normalizeRaceEthnicitySlice(
  raw: string | null | undefined,
): CanonicalRaceEthnicitySlice | null {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return 'all';
  }
  return LEGACY_SPELLINGS[raw.trim().toLowerCase()] ?? null;
}

/** The three non-overlapping groups Lives Across the Decades compares. */
export const LIVES_GROUP_SLICES = ['black_nh', 'white_nh', 'hispanic'] as const;

export type LivesGroupSlice = (typeof LIVES_GROUP_SLICES)[number];

export function isLivesGroupSlice(value: string): value is LivesGroupSlice {
  return (LIVES_GROUP_SLICES as readonly string[]).includes(value);
}

export const LIVES_GROUP_LABELS: Readonly<Record<LivesGroupSlice, string>> = {
  black_nh: 'Black',
  white_nh: 'White',
  hispanic: 'Hispanic',
};

export const LIVES_GROUP_DEFINITIONS: Readonly<Record<LivesGroupSlice, string>> = {
  black_nh: 'Black, not Hispanic',
  white_nh: 'White, not Hispanic',
  hispanic: 'Hispanic or Latino, of any race',
};
