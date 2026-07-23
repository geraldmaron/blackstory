/**
 * Theme browse catalog for the public /themes index — P0 live, P1 labeled coming soon.
 */

import type { ThemeImpactCatalogEntry } from './types';

export const THEME_IMPACT_CATALOG: readonly ThemeImpactCatalogEntry[] = [
  {
    id: 'redlining',
    title: 'Redlining',
    priority: 'P0',
    lede:
      'Federal and local housing-credit grading, where HOLC maps were drawn, and what followed in formerly graded places, with citations, not causal shortcuts.',
    available: true,
  },
  {
    id: 'drug_policy_state',
    title: 'Drug policy & the state',
    priority: 'P0',
    lede:
      'Documented government actions in drug markets and enforcement, read beside imprisonment and jail indicators across policy eras.',
    available: true,
  },
  {
    id: 'urban_renewal',
    title: 'Urban renewal',
    priority: 'P1',
    lede:
      'Major renewal and displacement projects, with demographic change in affected neighborhoods once the shared packet system is filled.',
    available: false,
  },
  {
    id: 'mass_incarceration',
    title: 'Mass incarceration',
    priority: 'P1',
    lede:
      'State-level imprisonment trends across modern justice eras, overlapping Phase 1 justice metrics, scheduled after P0 pilots.',
    available: false,
  },
  {
    id: 'environmental_racism',
    title: 'Environmental racism',
    priority: 'P1',
    lede:
      'Environmental burden indicators beside Black population share, pending EPA/EJ source ingestion and rights review.',
    available: false,
  },
] as const;

export function getThemeCatalogEntry(themeId: string): ThemeImpactCatalogEntry | undefined {
  return THEME_IMPACT_CATALOG.find((entry) => entry.id === themeId);
}

export function listAvailableThemeIds(): readonly string[] {
  return THEME_IMPACT_CATALOG.filter((entry) => entry.available).map((entry) => entry.id);
}
