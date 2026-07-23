/**
 * Theme browse catalog for the public /themes index.
 */

import type { ThemeImpactCatalogEntry } from './types';

export const THEME_IMPACT_CATALOG: readonly ThemeImpactCatalogEntry[] = [
  {
    id: 'redlining',
    title: 'Redlining',
    priority: 'P0',
    lede:
      'Federal appraisal and underwriting systems, Chicago HOLC evidence, and later housing and credit indicators, with disagreements and scale limits kept visible.',
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
] as const;

export function getThemeCatalogEntry(themeId: string): ThemeImpactCatalogEntry | undefined {
  return THEME_IMPACT_CATALOG.find((entry) => entry.id === themeId);
}

export function listAvailableThemeIds(): readonly string[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.available).map((entry) => entry.id);
}
