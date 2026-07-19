/**
 * Decennial Black-population comparability matrix: which census decades share a race
 * category label, where historical definitions diverge, and when county boundary changes
 * invalidate naive decade-over-decade deltas. This module documents comparability — it
 * does not synthesize counts, interpolate missing decades, or imply cross-era totals
 * without explicit NHGIS time-series tables and geography crosswalks.
 */
import { COUNTY_FIPS_CHANGES } from '../geography/county-fips-changes.js';

/** Coarse comparability band for decennial race tables — not a promise of numeric continuity. */
export type DecadeComparabilityBand =
  | '1790-1840-slave-and-free-colored'
  | '1850-1890-colored-and-negro'
  | '1900-1990-negro-and-black'
  | '2000-black-or-african-american-alone'
  | '2010-black-or-african-american-alone'
  | '2020-black-or-african-american-alone';

/** One documented decade span with its Census race category label and comparability notes. */
export type DecadeRaceCategoryBand = {
  /** Inclusive decade labels covered by this band (strings match census decade grammar). */
  readonly decades: readonly string[];
  readonly band: DecadeComparabilityBand;
  /** Census race category as published for the band — never normalized to a modern label. */
  readonly raceCategoryLabel: string;
  /** Human-readable comparability guidance; no fabricated statistics. */
  readonly notes: string;
};

/**
 * Bands for which a direct category-label match holds across 2000, 2010, and 2020 decennial
 * SF1/PL tables ingested via api.census.gov (see `../adapters/census-demographics/`).
 */
export const MODERN_BLACK_ALONE_BANDS: readonly DecadeComparabilityBand[] = [
  '2000-black-or-african-american-alone',
  '2010-black-or-african-american-alone',
  '2020-black-or-african-american-alone',
] as const;

/** Documented decade bands — definitions differ pre-2000; do not treat as one continuous series. */
export const DECADE_RACE_CATEGORY_BANDS: readonly DecadeRaceCategoryBand[] = [
  {
    decades: ['1790', '1800', '1810', '1820', '1830', '1840'],
    band: '1790-1840-slave-and-free-colored',
    raceCategoryLabel: 'Enslaved persons and free colored persons (separate counts; definitions vary by decade)',
    notes:
      'Early decennial schedules counted enslaved and free colored populations under evolving ' +
      'statutory categories. These figures are historical records of what was asked and tabulated — ' +
      'not comparable to post-2000 "Black or African American alone" without NHGIS harmonized tables ' +
      'and explicit methodology notes.',
  },
  {
    decades: ['1850', '1860', '1870', '1880', '1890'],
    band: '1850-1890-colored-and-negro',
    raceCategoryLabel: 'Colored / Negro (Census terminology of the era)',
    notes:
      'Mid-nineteenth-century race categories reflect Reconstruction-era and Gilded Age Census ' +
      'schedules. Category boundaries shifted across decades; year-over-year deltas require ' +
      'published crosswalks, not label matching alone.',
  },
  {
    decades: ['1900', '1910', '1920', '1930', '1940', '1950', '1960', '1970', '1980', '1990'],
    band: '1900-1990-negro-and-black',
    raceCategoryLabel: 'Negro / Black (Census terminology until revised OMB standards)',
    notes:
      'Twentieth-century decennial tables used "Negro" and later "Black" before the 1997 OMB ' +
      'standards and 2000 "Black or African American alone" one-race category. Treat pre-2000 and ' +
      'post-2000 counts as different measurement regimes unless NHGIS time-series documentation ' +
      'explicitly harmonizes them.',
  },
  {
    decades: ['2000'],
    band: '2000-black-or-african-american-alone',
    raceCategoryLabel: 'Black or African American alone',
    notes:
      '2000 dec/sf1 one-race table (P003004). Comparable at the category-label level to 2010 and ' +
      '2020 alone categories; county FIPS and boundary stability still required for spatial deltas.',
  },
  {
    decades: ['2010'],
    band: '2010-black-or-african-american-alone',
    raceCategoryLabel: 'Black or African American alone',
    notes:
      '2010 dec/sf1 one-race table (P003003). Same category label as 2000 and 2020; geography ' +
      'crosswalks may still be required when county equivalents change.',
  },
  {
    decades: ['2020'],
    band: '2020-black-or-african-american-alone',
    raceCategoryLabel: 'Black or African American alone',
    notes:
      '2020 dec/pl one-race table (P1_004N). Same category label as 2000 and 2010; Connecticut ' +
      'planning-region FIPS adoption (2022) affects joins against pre-2022 county series.',
  },
] as const;

/** Reusable UI / Firestore disclaimer for the modern alone-comparable trio. */
export const COMPARABILITY_NOTE_2000_2020 =
  'The 2000, 2010, and 2020 decennial vintages use the Census Bureau’s “Black or African American alone” ' +
  'one-race category. Category labels align across these three decades, but county-level decade-over-decade ' +
  'changes are not boundary-stable without crosswalks — see COUNTY_FIPS_CHANGES in @repo/domain geography. ' +
  'Pre-2000 decades use different race category definitions; BlackStory does not invent harmonized ' +
  'historical totals on this page.';

/** Caution string referencing canonical county FIPS transition records. */
export const BOUNDARY_CHANGE_CAUTION =
  `County and county-equivalent FIPS codes change over time (${COUNTY_FIPS_CHANGES.length} documented ` +
  'transitions through Connecticut’s 2022 planning-region switch). Naive subtraction of decennial counts ' +
  'across decades at the same FIPS code can misstate population change when boundaries split, merge, or ' +
  'rename. Use Census/NHGIS crosswalks for boundary-stable deltas.';

/** Lookup a comparability band for a decade label (e.g. "2010"). */
export function getDecadeRaceCategoryBand(decade: string): DecadeRaceCategoryBand | undefined {
  return DECADE_RACE_CATEGORY_BANDS.find((entry) => entry.decades.includes(decade));
}

/** True when the decade uses the modern "Black or African American alone" category label. */
export function isModernBlackAloneDecade(decade: string): boolean {
  const band = getDecadeRaceCategoryBand(decade)?.band;
  return band !== undefined && MODERN_BLACK_ALONE_BANDS.includes(band);
}
