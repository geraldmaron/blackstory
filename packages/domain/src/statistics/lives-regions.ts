/**
 * Regions modeled by Lives Across the Decades. A region is a `bb_reference.jurisdictions` row of
 * kind `region`; what it covered in each decade lives in `region_decade_definitions`, because IPUMS
 * identifies metro areas differently across censuses. The core counties here are the stable
 * center used to resolve county-level rules, not the per-decade tabulation extent.
 *
 * Regions are added only after the Phase 0 sample-depth check admits them
 * (docs/methodology/lives-across-decades.md).
 */

export type LivesRegionConfig = {
  readonly id: `region:${string}`;
  /** URL segment under /lives. */
  readonly slug: string;
  readonly name: string;
  readonly parentId: `state:${string}`;
  readonly stateFips: string;
  readonly coreCountyFips: readonly string[];
  readonly aliases: readonly string[];
};

export const LIVES_REGIONS: readonly LivesRegionConfig[] = [
  {
    id: 'region:chicago-il',
    slug: 'chicago',
    name: 'Chicago area, Illinois',
    parentId: 'state:17',
    stateFips: '17',
    coreCountyFips: ['17031', '17043'],
    aliases: ['metro:chicago-il'],
  },
];

export function livesRegionBySlug(slug: string): LivesRegionConfig | undefined {
  return LIVES_REGIONS.find((region) => region.slug === slug);
}

export function livesRegionById(id: string): LivesRegionConfig | undefined {
  return LIVES_REGIONS.find((region) => region.id === id);
}
