/**
 * Unit of analysis for Lives Across the Decades. The street never implies an unnamed "you";
 * the reader picks household, child, or woman, and every caption names that unit.
 * Method: docs/methodology/lives-across-decades.md.
 */
export const LIVES_UNITS = ['household', 'child', 'woman'] as const;

export type LivesUnit = (typeof LIVES_UNITS)[number];

export const LIVES_UNIT_LABELS: Readonly<Record<LivesUnit, string>> = {
  household: 'Household',
  child: 'Child',
  woman: 'Woman',
};

/** Archive-voice kickers that state who the census counted. */
export const LIVES_UNIT_KICKERS: Readonly<Record<LivesUnit, string>> = {
  household: 'The census counted households.',
  child: 'Schooling is the children in this group.',
  woman: 'Women in gainful work, as the occupation tables named them.',
};

export function isLivesUnit(value: string): value is LivesUnit {
  return (LIVES_UNITS as readonly string[]).includes(value);
}

/**
 * Which scene layers and condition keys carry the selected unit. Other layers stay visible as
 * context but are de-emphasized and never relabeled as belonging to that unit.
 */
export function livesUnitEmphasis(unit: LivesUnit): {
  readonly primaryConditionKeys: readonly string[];
  readonly primaryLifeDomains: readonly string[];
  readonly refuseAsOwn: readonly string[];
} {
  switch (unit) {
    case 'child':
      return {
        primaryConditionKeys: ['school_attendance', 'literacy', 'high_school'],
        primaryLifeDomains: ['schooling', 'family'],
        refuseAsOwn: ['income_to_national_median', 'homeownership'],
      };
    case 'woman':
      return {
        primaryConditionKeys: ['unemployed', 'farm_tenancy'],
        primaryLifeDomains: ['work', 'family', 'voting'],
        refuseAsOwn: ['homeownership', 'income_to_national_median'],
      };
    case 'household':
    default:
      return {
        primaryConditionKeys: [
          'homeownership',
          'urban',
          'farm_tenancy',
          'income_to_national_median',
          'population_share',
        ],
        primaryLifeDomains: ['housing', 'credit', 'work'],
        refuseAsOwn: [],
      };
  }
}
