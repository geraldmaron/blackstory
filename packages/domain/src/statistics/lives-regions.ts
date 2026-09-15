/**
 * The areas Lives Across the Decades can be read for: six regions, each a union of whole states, and a
 * national baseline. Every state (and the District of Columbia) belongs to exactly one region, so the
 * regions sum to the nation. Plan of record: docs/research/lives-regions-and-sources.md.
 */

export type LivesAreaConfig = {
  readonly id: string;
  readonly kind: 'nation' | 'region';
  /** URL segment under /lives. */
  readonly slug: string;
  readonly name: string;
  /** One sentence naming what makes the area's history distinct. */
  readonly summary: string;
  /** State FIPS codes, two digits. */
  readonly memberStateFips: readonly string[];
};

export const LIVES_REGIONS: readonly LivesAreaConfig[] = [
  {
    id: 'region:us-deep-south',
    kind: 'region',
    slug: 'deep-south',
    name: 'Deep South',
    summary:
      'Sharecropping, disfranchisement and the counties the Great Migration left, and later Cuban Florida.',
    memberStateFips: ['01', '05', '12', '13', '22', '28', '45'],
  },
  {
    id: 'region:us-upper-south',
    kind: 'region',
    slug: 'upper-south',
    name: 'Upper South & the Capital',
    summary:
      'Black colleges, federal employment, a Black middle class and border-state segregation.',
    memberStateFips: ['10', '11', '21', '24', '37', '47', '51', '54'],
  },
  {
    id: 'region:us-texas-oklahoma',
    kind: 'region',
    slug: 'texas-oklahoma',
    name: 'Texas & Oklahoma',
    summary: 'Jim Crow law on a borderland, Tejano history and oil.',
    memberStateFips: ['40', '48'],
  },
  {
    id: 'region:us-west',
    kind: 'region',
    slug: 'west',
    name: 'The West',
    summary: 'The Mexican American Southwest and California, and the wartime Black migration West.',
    memberStateFips: ['02', '04', '06', '08', '15', '16', '30', '32', '35', '41', '49', '53', '56'],
  },
  {
    id: 'region:us-midwest',
    kind: 'region',
    slug: 'midwest',
    name: 'Midwest',
    summary:
      'A Great Migration destination of auto and steel work, Mexican Chicago and deindustrialization.',
    memberStateFips: ['17', '18', '19', '20', '26', '27', '29', '31', '38', '39', '46', '55'],
  },
  {
    id: 'region:us-northeast',
    kind: 'region',
    slug: 'northeast',
    name: 'Northeast',
    summary: 'Harlem and Philadelphia, and the Puerto Rican migration to New York.',
    memberStateFips: ['09', '23', '25', '33', '34', '36', '42', '44', '50'],
  },
];

export const LIVES_NATIONAL: LivesAreaConfig = {
  id: 'nation:US',
  kind: 'nation',
  slug: 'united-states',
  name: 'United States',
  summary: 'The whole country, the baseline every region is read against.',
  memberStateFips: LIVES_REGIONS.flatMap((region) => region.memberStateFips).sort(),
};

/** Every area a reader can open: the national baseline first, then the six regions. */
export const LIVES_AREAS: readonly LivesAreaConfig[] = [LIVES_NATIONAL, ...LIVES_REGIONS];

export function livesAreaBySlug(slug: string): LivesAreaConfig | undefined {
  return LIVES_AREAS.find((area) => area.slug === slug);
}

export function livesAreaById(id: string): LivesAreaConfig | undefined {
  return LIVES_AREAS.find((area) => area.id === id);
}

export function livesRegionForState(stateFips: string): LivesAreaConfig | undefined {
  return LIVES_REGIONS.find((region) => region.memberStateFips.includes(stateFips));
}

export function livesStateJurisdictionId(stateFips: string): string {
  return `state:${stateFips}`;
}
