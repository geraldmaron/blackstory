import type { ExploreMapFeature } from '../../../lib/map-experience/build-explore-map-source';

export function decadeStartYear(bucket: string): number {
  const parsed = Number.parseInt(bucket, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function eraBucketFor(decade: number): string {
  return `${decade}s`;
}

export function eraFor(feature: ExploreMapFeature): string {
  return feature.properties.eraBuckets[0] ?? 'Undated';
}
