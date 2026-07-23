/**
 * Mono meta line for Explore preview rows and sheets — place/kind/year in IBM
 * Plex Mono (`code` type role) per the brand contract.
 */

export type PreviewMetaFeature = {
  readonly kind: string;
  readonly properties: {
    readonly stateName?: string;
    readonly statePostalCode?: string;
    readonly year?: number;
    readonly yearLabel?: string;
  };
};

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Compact place · year (or kind · place) string for preview meta. */
export function featureMetaLine(feature: PreviewMetaFeature): string {
  const place = feature.properties.stateName ?? feature.properties.statePostalCode;
  const kind = capitalize(feature.kind);
  const year =
    typeof feature.properties.year === 'number'
      ? String(feature.properties.year)
      : typeof feature.properties.yearLabel === 'string'
        ? feature.properties.yearLabel
        : null;

  if (place && year) return `${place} · ${year}`;
  if (place && kind) return `${kind} · ${place}`;
  if (year) return `${kind} · ${year}`;
  return kind;
}
