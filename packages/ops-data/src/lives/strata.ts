/**
 * Work-based class for 1870–1930, from the 1950-basis occupation code (IPUMS `OCC1950`).
 *
 * The census did not ask about income before 1940, so class comes from the kind of work the
 * household head did. These strata are not income classes and are never labeled as income.
 * `OCCSCORE` is deliberately not used: it gives every worker in an occupation that
 * occupation's 1950 median income, which erases pay gaps between races doing the same work.
 * Method: docs/methodology/lives-across-decades.md.
 *
 * Major-group ranges follow the 1950 census occupation classification as carried in IPUMS:
 * professional 000–099, farmers 100, farm managers 123, managers/officials/proprietors 200–290,
 * clerical 300–390, sales 400–490, craftsmen 500–594, armed forces 595, operatives 600–690,
 * private household 700–720, service 730–790, farm laborers 810–840, laborers 910–977, and
 * non-occupational responses from 979.
 */

export const OCCUPATIONAL_STRATA = ['lower', 'middle', 'upper', 'unclassified'] as const;

export type OccupationalStratum = (typeof OCCUPATIONAL_STRATA)[number];

export type Occ1950MajorGroup =
  | 'professional'
  | 'farmer'
  | 'farm_manager'
  | 'manager_official_proprietor'
  | 'clerical'
  | 'sales'
  | 'craft'
  | 'armed_forces'
  | 'operative'
  | 'private_household'
  | 'service'
  | 'farm_laborer'
  | 'laborer'
  | 'non_occupational';

export function occ1950MajorGroup(code: number): Occ1950MajorGroup {
  if (!Number.isInteger(code) || code < 0) return 'non_occupational';
  if (code <= 99) return 'professional';
  if (code === 100) return 'farmer';
  if (code === 123) return 'farm_manager';
  if (code >= 200 && code <= 290) return 'manager_official_proprietor';
  if (code >= 300 && code <= 390) return 'clerical';
  if (code >= 400 && code <= 490) return 'sales';
  if (code >= 500 && code <= 594) return 'craft';
  if (code === 595) return 'armed_forces';
  if (code >= 600 && code <= 690) return 'operative';
  if (code >= 700 && code <= 720) return 'private_household';
  if (code >= 730 && code <= 790) return 'service';
  if (code >= 810 && code <= 840) return 'farm_laborer';
  if (code >= 910 && code <= 977) return 'laborer';
  return 'non_occupational';
}

export function hasOccupation(code: number): boolean {
  const group = occ1950MajorGroup(code);
  return group !== 'non_occupational' && group !== 'armed_forces';
}

/**
 * IPUMS `OWNERSHP`: 1 owned or being bought, 2 rented, 0 not applicable. It records tenure of
 * the dwelling, which for farm households in 1900–1930 tracks whether the farm was owned or
 * rented closely but not perfectly. The comparability note for those decades says so.
 */
export type DwellingTenure = 'owned' | 'rented' | 'unknown';

export function dwellingTenureFromOwnershp(value: number | null | undefined): DwellingTenure {
  if (value === 1) return 'owned';
  if (value === 2) return 'rented';
  return 'unknown';
}

export type StratumAssignment = {
  readonly stratum: OccupationalStratum;
  readonly majorGroup: Occ1950MajorGroup;
  readonly reason: string;
};

/**
 * The stratum for one occupation. Tenant farmers are lower because the census counted
 * sharecroppers as tenant farm operators. A farmer whose tenure is unknown (1870, 1880, or a
 * missing value) is unclassified rather than guessed. Armed forces are unclassified: rank is not
 * recorded, so a private and an officer look the same.
 */
export function occupationalStratum(code: number, tenure: DwellingTenure): StratumAssignment {
  const majorGroup = occ1950MajorGroup(code);
  switch (majorGroup) {
    case 'professional':
    case 'manager_official_proprietor':
      return { stratum: 'upper', majorGroup, reason: majorGroup };
    case 'clerical':
    case 'sales':
    case 'craft':
    case 'operative':
    case 'farm_manager':
      return { stratum: 'middle', majorGroup, reason: majorGroup };
    case 'private_household':
    case 'service':
    case 'farm_laborer':
    case 'laborer':
      return { stratum: 'lower', majorGroup, reason: majorGroup };
    case 'farmer':
      if (tenure === 'owned') return { stratum: 'middle', majorGroup, reason: 'farm owner' };
      if (tenure === 'rented') return { stratum: 'lower', majorGroup, reason: 'tenant farmer' };
      return { stratum: 'unclassified', majorGroup, reason: 'farmer with unrecorded tenure' };
    case 'armed_forces':
      return { stratum: 'unclassified', majorGroup, reason: 'armed forces, rank not recorded' };
    case 'non_occupational':
      return { stratum: 'unclassified', majorGroup, reason: 'no occupation reported' };
  }
}

export type HouseholdMember = {
  /** Enumeration order within the household (IPUMS `PERNUM`, 1 is the head). */
  readonly pernum: number;
  readonly age: number;
  readonly occ1950: number;
};

/**
 * The household's stratum: the head's occupation, or when the head reports none, the first adult
 * (18+) in enumeration order who reports one. The household's tenure applies to whoever supplies
 * the occupation.
 */
export function householdOccupationalStratum(
  members: readonly HouseholdMember[],
  tenure: DwellingTenure,
): StratumAssignment {
  const ordered = [...members].sort((a, b) => a.pernum - b.pernum);
  const head = ordered.find((member) => member.pernum === 1);
  if (head && hasOccupation(head.occ1950)) {
    return occupationalStratum(head.occ1950, tenure);
  }
  const fallback = ordered.find((member) => member.age >= 18 && hasOccupation(member.occ1950));
  if (fallback) {
    const assignment = occupationalStratum(fallback.occ1950, tenure);
    return { ...assignment, reason: `${assignment.reason} (first adult with an occupation)` };
  }
  return {
    stratum: 'unclassified',
    majorGroup: 'non_occupational',
    reason: 'no adult in the household reported an occupation',
  };
}
