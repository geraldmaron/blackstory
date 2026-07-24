/**
 * Soft cross-theme threads for theme detail footers.
 * Links shared spines without implying a forced graph.
 */

export type ThemeRelatedThread = {
  readonly themeId: string;
  readonly label: string;
  readonly reason: string;
};

const RELATED_BY_THEME: Readonly<Record<string, readonly ThemeRelatedThread[]>> = {
  redlining: [
    {
      themeId: 'school_segregation',
      label: 'School segregation & opportunity',
      reason: 'Segregated housing sits beside school opportunity.',
    },
    {
      themeId: 'voting_rights',
      label: 'Voting rights & political exclusion',
      reason: 'Place and franchise enforcement share a long civic spine.',
    },
    {
      themeId: 'urban_renewal',
      label: 'Urban renewal',
      reason: 'Later clearance projects reworked the same neighborhoods.',
    },
  ],
  school_segregation: [
    {
      themeId: 'redlining',
      label: 'Housing segregation & redlining',
      reason: 'Neighborhood lines precede classroom lines.',
    },
    {
      themeId: 'voting_rights',
      label: 'Voting rights & political exclusion',
      reason: 'Civic capacity and school opportunity move together in the record.',
    },
  ],
  voting_rights: [
    {
      themeId: 'redlining',
      label: 'Housing segregation & redlining',
      reason: 'Housing exclusion and ballot exclusion share institutional history.',
    },
    {
      themeId: 'school_segregation',
      label: 'School segregation & opportunity',
      reason: 'Education and franchise sit on the same long civic arc.',
    },
    {
      themeId: 'mass_incarceration',
      label: 'Mass incarceration',
      reason: 'Imprisonment and restored voting rights remain adjacent civic facts.',
    },
  ],
  drug_policy_state: [
    {
      themeId: 'mass_incarceration',
      label: 'Mass incarceration',
      reason: 'Sentencing eras sit beside national and state imprisonment instruments.',
    },
  ],
  mass_incarceration: [
    {
      themeId: 'drug_policy_state',
      label: 'Drug policy, sentencing & enforcement',
      reason: 'Drug statutes and caseloads help explain who enters prison systems.',
    },
    {
      themeId: 'voting_rights',
      label: 'Voting rights & political exclusion',
      reason: 'Felony disenfranchisement links custody counts to the ballot.',
    },
  ],
  urban_renewal: [
    {
      themeId: 'redlining',
      label: 'Housing segregation & redlining',
      reason: 'Clearance projects followed earlier credit and occupancy rules.',
    },
  ],
  environmental_racism: [
    {
      themeId: 'redlining',
      label: 'Housing segregation & redlining',
      reason: 'Burden maps often track historically segregated places.',
    },
  ],
};

export function listRelatedThemeThreads(
  themeId: string,
): readonly ThemeRelatedThread[] {
  return RELATED_BY_THEME[themeId] ?? [];
}
