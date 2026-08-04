/**
 * Theme catalog: code-owned metadata for the public /themes surface.
 *
 * Theme ids are structurally coupled to the domain enum, question registry, and
 * routes, so the catalog deliberately lives in code rather than the database.
 * Availability is NOT declared here: a theme is available when the active
 * release carries at least one packet for it — see `resolveAvailableThemeIds`
 * in `source.ts`.
 */

export type ThemeImpactCatalogEntry = {
  readonly id: string;
  readonly title: string;
  readonly priority: 'P0' | 'P1';
  readonly lede: string;
};

export const THEME_IMPACT_CATALOG: readonly ThemeImpactCatalogEntry[] = [
  {
    id: 'redlining',
    title: 'Housing segregation & redlining',
    priority: 'P0',
    lede: 'Walk from a named beach in 1919 through federal maps, county instruments, and a South Side district you can still name. Metro readings where the record is densest; national wealth for scale.',
  },
  {
    id: 'drug_policy_state',
    title: 'Drug policy, sentencing & enforcement',
    priority: 'P0',
    lede: 'Federal statutes read beside jail, sentencing, and imprisonment instruments, without speculative intelligence-market claims.',
  },
  {
    id: 'wealth_gap',
    title: 'The gap that never closed',
    priority: 'P0',
    lede: 'The white-to-Black wealth ratio from Emancipation to the latest federal survey, read as one continuous series beside the rules in force along the way.',
  },
  {
    id: 'urban_renewal',
    title: 'Urban renewal',
    priority: 'P1',
    lede: 'Federal project records, reported family and housing fields, and later county demographics, with missing project fields kept unknown.',
  },
  {
    id: 'mass_incarceration',
    title: 'Mass incarceration',
    priority: 'P1',
    lede: 'National BJS-published adult imprisonment rates across a decade, then a distinct ACS-denominator state Black-White disparity cross-section for 2022-2023.',
  },
  {
    id: 'environmental_racism',
    title: 'Environmental justice & unequal burden',
    priority: 'P1',
    lede: 'An Illinois county test using ACS, CDC EJI, and EPA TRI data, including the mixed results that challenge a simple facility-count story.',
  },
  {
    id: 'school_segregation',
    title: 'School segregation & opportunity',
    priority: 'P1',
    lede: 'How residential segregation feeds school opportunity. Metro attainment sits beside national BA+ shares and the desegregation record; district discipline series stay unloaded.',
  },
  {
    id: 'voting_rights',
    title: 'Voting rights & political exclusion',
    priority: 'P1',
    lede: 'Franchise rules from Reconstruction through the Voting Rights Act, with Census CPS A-1 national turnout for presidential years 1992-2020. State policy indexes remain cite-first.',
  },
] as const;

export function getThemeCatalogEntry(themeId: string): ThemeImpactCatalogEntry | undefined {
  return THEME_IMPACT_CATALOG.find((entry) => entry.id === themeId);
}

export function listCatalogThemeIds(): readonly string[] {
  return THEME_IMPACT_CATALOG.map((entry) => entry.id);
}

export function listP0Themes(): readonly ThemeImpactCatalogEntry[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.priority === 'P0');
}

export function listP1Themes(): readonly ThemeImpactCatalogEntry[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.priority === 'P1');
}
