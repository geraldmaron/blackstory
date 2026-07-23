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
      'A human story of how violence, private covenants, and federal underwriting locked neighborhoods apart. Chicago and Cook County are the example metro for reading a national pattern, with later housing and credit indicators kept beside that history.',
    available: true,
  },
  {
    id: 'drug_policy_state',
    title: 'Drug policy, sentencing & enforcement',
    priority: 'P0',
    lede:
      'Primary federal statutes read beside jail, imprisonment, and cocaine-sentencing series, without speculative intelligence-market claims.',
    available: true,
  },
  {
    id: 'urban_renewal',
    title: 'Urban renewal',
    priority: 'P1',
    lede:
      'Chicago federal project records, reported family and housing fields, and later county demographics, with missing project fields kept unknown.',
    available: true,
  },
  {
    id: 'mass_incarceration',
    title: 'Mass incarceration',
    priority: 'P1',
    lede:
      'A distinct 50-state comparison of Black–White imprisonment-rate disparities in the latest comparable year, not a duplicate drug-policy timeline.',
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
      'How residential segregation feeds school opportunity. Cook County attainment sits beside the desegregation record as an example reading, with district discipline series still gap-labeled.',
    available: true,
  },
  {
    id: 'voting_rights',
    title: 'Voting rights & political exclusion',
    priority: 'P1',
    lede:
      'Franchise rules from Reconstruction through the Voting Rights Act, told as a connected enforcement story. Turnout and state policy indexes remain cite-first until warehouse series load.',
    available: true,
  },
] as const;

export function getThemeCatalogEntry(themeId: string): ThemeImpactCatalogEntry | undefined {
  return THEME_IMPACT_CATALOG.find((entry) => entry.id === themeId);
}

export function listAvailableThemeIds(): readonly string[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.available).map((entry) => entry.id);
}
