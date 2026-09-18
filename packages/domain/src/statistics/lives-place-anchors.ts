/**
 * Catalog place anchors for Lives regions: illustration only, never carriers of city rates.
 * Plan of record: docs/research/lives-regions-and-sources.md.
 */
import type { LivesAreaConfig } from './lives-regions.js';

/** One named place that illustrates a region without becoming its figure. */
export type LivesPlaceAnchor = {
  readonly name: string;
  /** Why this place is on the region, in one short clause. */
  readonly role: string;
  /** Catalog or room path; optional when the place is named for orientation only. */
  readonly href?: string;
};

const ANCHORS: Readonly<Record<string, readonly LivesPlaceAnchor[]>> = {
  'region:us-deep-south': [
    {
      name: 'Mississippi Delta',
      role: 'Plantation counties and the Great Migration’s departure belt',
      href: '/stories',
    },
    {
      name: 'Birmingham',
      role: 'Industrial Jim Crow and civil-rights confrontation',
      href: '/explore?q=Birmingham',
    },
    {
      name: 'Miami',
      role: 'Cuban Florida after mid-century',
      href: '/explore?q=Miami',
    },
  ],
  'region:us-upper-south': [
    {
      name: 'Washington, D.C.',
      role: 'Federal employment and a Black middle class at the capital',
      href: '/explore?q=Washington',
    },
    {
      name: 'Richmond',
      role: 'Border-state segregation and Black colleges nearby',
      href: '/explore?q=Richmond',
    },
    {
      name: 'Memphis',
      role: 'River city on the Upper / Deep South edge',
      href: '/explore?q=Memphis',
    },
  ],
  'region:us-texas-oklahoma': [
    {
      name: 'Houston',
      role: 'Jim Crow on a Gulf borderland',
      href: '/explore?q=Houston',
    },
    {
      name: 'San Antonio',
      role: 'Tejano continuity beside the Texas count',
      href: '/explore?q=San%20Antonio',
    },
    {
      name: 'Tulsa',
      role: 'Greenwood and the 1921 massacre in Oklahoma',
      href: '/explore?q=Tulsa',
    },
  ],
  'region:us-west': [
    {
      name: 'East Los Angeles',
      role: 'Mexican American Southwest in California',
      href: '/explore?q=East%20Los%20Angeles',
    },
    {
      name: 'Oakland',
      role: 'Wartime Black migration to the Bay',
      href: '/explore?q=Oakland',
    },
    {
      name: 'Albuquerque',
      role: 'Spanish-surname Southwest before 1970',
      href: '/explore?q=Albuquerque',
    },
  ],
  'region:us-midwest': [
    {
      name: 'Bronzeville',
      role: 'Chicago’s Great Migration neighborhood',
      href: '/explore?q=Bronzeville',
    },
    {
      name: 'Detroit',
      role: 'Auto work and Northern industrial segregation',
      href: '/explore?q=Detroit',
    },
    {
      name: 'St. Louis',
      role: 'River city on the Midwest / Upper South edge',
      href: '/explore?q=St.%20Louis',
    },
  ],
  'region:us-northeast': [
    {
      name: 'Harlem',
      role: 'Northern Black capital of the early twentieth century',
      href: '/explore?q=Harlem',
    },
    {
      name: 'Philadelphia',
      role: 'Long Black urban presence beside New York',
      href: '/explore?q=Philadelphia',
    },
    {
      name: 'El Barrio',
      role: 'Puerto Rican migration to New York',
      href: '/explore?q=East%20Harlem',
    },
  ],
  'nation:US': [
    {
      name: 'National baseline',
      role: 'Every region is read against the whole country',
      href: '/lives',
    },
    {
      name: 'Data spines',
      role: 'National-only series (health, justice) stay on /data',
      href: '/data',
    },
    {
      name: 'Methodology',
      role: 'How figures, gaps, and off-ramps are labeled',
      href: '/methodology#lives-across-decades',
    },
  ],
};

/** Two or three illustration places for an area. Empty only if the area id is unknown. */
export function livesPlaceAnchorsForArea(
  area: Pick<LivesAreaConfig, 'id'>,
): readonly LivesPlaceAnchor[] {
  return ANCHORS[area.id] ?? [];
}
