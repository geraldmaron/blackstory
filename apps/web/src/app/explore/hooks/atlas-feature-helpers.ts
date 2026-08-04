import type { RecordAnatomyPlace } from '../../../components/patterns/RecordAnatomyPanel';
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

/**
 * The feature's published precision, narrowed to the five values the anatomy panel captions.
 *
 * The map carries `locationPrecision` as an open string because the release vocabulary is wider
 * than what this panel names. Anything outside the five falls back to `city`, which is the
 * coarsest of the point-level options and so cannot overstate how sharp the pin is. Overstating
 * is the only failure mode that matters here: the caption is the archive's claim about what its
 * own dot means.
 */
export function anatomyPrecisionFor(precision: string): RecordAnatomyPlace['precision'] {
  switch (precision) {
    case 'county':
    case 'city':
    case 'neighborhood':
    case 'campus':
    case 'institution':
      return precision;
    default:
      return 'city';
  }
}
