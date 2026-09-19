/**
 * Race and ethnicity for Lives Across the Decades and other statistical surfaces.
 *
 * Two ideas, kept apart on purpose:
 * - A **definition** is what a published table actually counted: "Negro" in 1950, "White alone, not
 *   Hispanic" in 2020, "White persons of Spanish surname" in five Southwestern states in 1960.
 *   Observations are stored under the definition their table used.
 * - A **lens** is what a reader chooses: Black, white or Hispanic. Each era's figures reach a lens
 *   through the definition that era published, and the surface always names that definition.
 *
 * Live rows carry at least eleven spellings of definitions. The normalizer merges only spellings that
 * mean the same thing; it never turns a race-only definition into a non-Hispanic one.
 * Method: docs/methodology/lives-across-decades.md.
 */

export const CANONICAL_RACE_ETHNICITY_SLICES = [
  /** Every person in the universe. Stored as a null slice. */
  'all',
  'black_nh',
  'white_nh',
  'hispanic',
  'black_alone',
  'white_alone',
  /** Black as the source defined it ("Negro", "Black"), Hispanic origin not separated. */
  'black',
  /** White as the source defined it, Hispanic origin not separated. */
  'white',
  /** Every group other than white, as 1950–1960 tables often published it. */
  'nonwhite',
  /** 1970 Spanish origin, asked of a sample. */
  'spanish_origin',
  /** 1950–1960 white persons of Spanish surname, five Southwestern states only. */
  'spanish_surname',
  /** 1950–1960 persons of Puerto Rican birth or parentage. */
  'puerto_rican',
  /** 1930 "Mexican," counted as a race that year only. */
  'mexican',
  'asian',
] as const;

export type CanonicalRaceEthnicitySlice = (typeof CANONICAL_RACE_ETHNICITY_SLICES)[number];

const SPELLINGS: Readonly<Record<string, CanonicalRaceEthnicitySlice>> = {
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
  negro: 'black',
  white: 'white',
  nonwhite: 'nonwhite',
  spanish_origin: 'spanish_origin',
  spanish_surname: 'spanish_surname',
  puerto_rican: 'puerto_rican',
  mexican: 'mexican',
  asian: 'asian',
};

/**
 * Maps a stored slice to its canonical definition. A null or empty slice is `all`. An unrecognized
 * spelling returns null so the caller decides, rather than guessing a definition.
 */
export function normalizeRaceEthnicitySlice(
  raw: string | null | undefined,
): CanonicalRaceEthnicitySlice | null {
  if (raw === null || raw === undefined || raw.trim() === '') return 'all';
  return SPELLINGS[raw.trim().toLowerCase()] ?? null;
}

/** What the census counted, in words a reader sees next to every figure. */
export const RACE_ETHNICITY_DEFINITION_LABELS: Readonly<
  Record<CanonicalRaceEthnicitySlice, string>
> = {
  all: 'Everyone',
  black_nh: 'Black, not Hispanic',
  white_nh: 'White, not Hispanic',
  hispanic: 'Hispanic or Latino, of any race',
  black_alone: 'Black or African American alone',
  white_alone: 'White alone',
  black: 'Black, as the census recorded it (Hispanic origin not separated)',
  white: 'White, as the census recorded it (includes people later counted as Hispanic)',
  nonwhite: 'Nonwhite: every group other than white, counted together',
  spanish_origin: 'Spanish origin, from a sample question with known misclassification',
  spanish_surname: 'White persons of Spanish surname, five Southwestern states only',
  puerto_rican: 'Persons of Puerto Rican birth or parentage',
  mexican: '"Mexican," counted as a race in 1930 only',
  asian: 'Asian',
};

/** The three lenses a reader chooses between. */
export const LIVES_LENSES = ['black', 'white', 'hispanic'] as const;

export type LivesLens = (typeof LIVES_LENSES)[number];

export function isLivesLens(value: string): value is LivesLens {
  return (LIVES_LENSES as readonly string[]).includes(value);
}

export const LIVES_LENS_LABELS: Readonly<Record<LivesLens, string>> = {
  black: 'Black',
  white: 'White',
  hispanic: 'Hispanic',
};

/**
 * The published definitions that can stand for each lens, most specific first. When a table
 * publishes several, the first one present wins and its label travels with the figure.
 */
export const LIVES_LENS_DEFINITIONS: Readonly<
  Record<LivesLens, readonly CanonicalRaceEthnicitySlice[]>
> = {
  black: ['black_nh', 'black_alone', 'black', 'nonwhite'],
  white: ['white_nh', 'white_alone', 'white'],
  hispanic: ['hispanic', 'spanish_origin', 'spanish_surname', 'puerto_rican', 'mexican'],
};

/** The lens a published definition can stand for, or null when it stands for none. */
export function lensForDefinition(definition: CanonicalRaceEthnicitySlice): LivesLens | null {
  for (const lens of LIVES_LENSES) {
    if (LIVES_LENS_DEFINITIONS[lens].includes(definition)) return lens;
  }
  return null;
}

/** Of the definitions present, the one that should stand for the lens. */
export function preferredDefinition(
  lens: LivesLens,
  present: Iterable<CanonicalRaceEthnicitySlice>,
): CanonicalRaceEthnicitySlice | null {
  const available = new Set(present);
  return LIVES_LENS_DEFINITIONS[lens].find((definition) => available.has(definition)) ?? null;
}
