/**
 * Theme browse catalog for the public /themes index.
 */

import type { ThemeImpactCatalogEntry } from './types';

export const THEME_IMPACT_CATALOG: readonly ThemeImpactCatalogEntry[] = [
  {
    id: 'redlining',
    title: 'Housing segregation & redlining',
    priority: 'P0',
    lede:
      'Walk from a named beach in 1919 through federal maps, county instruments, and a South Side district you can still name. Metro readings where the record is densest; national wealth for scale.',
    available: true,
  },
  {
    id: 'drug_policy_state',
    title: 'Drug policy, sentencing & enforcement',
    priority: 'P0',
    lede:
      'Federal statutes read beside jail, sentencing, and imprisonment instruments, without speculative intelligence-market claims.',
    available: true,
  },
  {
    id: 'urban_renewal',
    title: 'Urban renewal',
    priority: 'P1',
    lede:
      'Federal project records, reported family and housing fields, and later county demographics, with missing project fields kept unknown.',
    available: true,
  },
  {
    id: 'mass_incarceration',
    title: 'Mass incarceration',
    priority: 'P1',
    lede:
      'National BJS-published adult imprisonment rates across a decade, then a distinct ACS-denominator state Black-White disparity cross-section for 2022-2023.',
    available: true,
  },
  {
    id: 'environmental_racism',
    title: 'Environmental justice & unequal burden',
    priority: 'P1',
    lede:
      'An Illinois county test using ACS, CDC EJI, and EPA TRI data, including the mixed results that challenge a simple facility-count story.',
    available: true,
  },
  {
    id: 'school_segregation',
    title: 'School segregation & opportunity',
    priority: 'P1',
    lede:
      'How residential segregation feeds school opportunity. Metro attainment sits beside national BA+ shares and the desegregation record; district discipline series stay unloaded.',
    available: true,
  },
  {
    id: 'voting_rights',
    title: 'Voting rights & political exclusion',
    priority: 'P1',
    lede:
      'Franchise rules from Reconstruction through the Voting Rights Act, with Census CPS A-1 national turnout for presidential years 1992-2020. State policy indexes remain cite-first.',
    available: true,
  },
] as const;

export function getThemeCatalogEntry(themeId: string): ThemeImpactCatalogEntry | undefined {
  return THEME_IMPACT_CATALOG.find((entry) => entry.id === themeId);
}

export function listAvailableThemeIds(): readonly string[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.available).map((entry) => entry.id);
}
