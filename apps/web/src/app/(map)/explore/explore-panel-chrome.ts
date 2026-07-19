/**
 * Pure class-name helpers for Explore panel hide/show chrome (filters rail + results rail).
 * Keeps ExploreMapExperience JSX readable and gives tests a stable contract for CSS hooks.
 */

export function exploreFiltersPanelClassName(options: { readonly visible: boolean }): string {
  return options.visible
    ? 'ds-explore-stage__filters'
    : 'ds-explore-stage__filters ds-explore-stage__filters--hidden';
}

export function exploreResultsPanelClassName(options: {
  readonly visible: boolean;
  readonly dimmed: boolean;
}): string {
  const parts = ['ds-explore-stage__results'];
  if (!options.visible) parts.push('ds-explore-stage__results--hidden');
  if (options.dimmed) parts.push('ds-explore-stage__results--dimmed');
  return parts.join(' ');
}
