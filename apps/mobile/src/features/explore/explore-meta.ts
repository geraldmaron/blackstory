/**
 * Mono meta helpers for Explore preview rows and NarrativeCard-style sheets —
 * kind slug, compact place/year line, and labeled at-a-glance facts (era /
 * precision / place) in IBM Plex Mono (`code` type role) per the brand contract.
 */

export type PreviewMetaFeature = {
  readonly kind: string;
  readonly properties: {
    readonly stateName?: string;
    readonly statePostalCode?: string;
    readonly year?: number;
    readonly yearLabel?: string;
    readonly precision?: string;
    readonly eraBuckets?: readonly string[];
  };
};

/** One labeled fact for the preview at-a-glance strip (literal dt/dd pair). */
export type AtAGlanceFact = {
  readonly label: string;
  readonly value: string;
};

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function placeLabel(properties: PreviewMetaFeature['properties']): string | null {
  const place = properties.stateName ?? properties.statePostalCode;
  if (typeof place !== 'string') return null;
  const trimmed = place.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function eraLabel(properties: PreviewMetaFeature['properties']): string | null {
  if (typeof properties.year === 'number') return String(properties.year);
  if (typeof properties.yearLabel === 'string' && properties.yearLabel.trim().length > 0) {
    return properties.yearLabel.trim();
  }
  const buckets = (properties.eraBuckets ?? [])
    .map((bucket) => bucket.trim())
    .filter((bucket) => bucket.length > 0);
  if (buckets.length === 0) return null;
  if (buckets.length === 1) return buckets[0]!;
  return `${buckets[0]!} to ${buckets[buckets.length - 1]!}`;
}

function precisionLabel(properties: PreviewMetaFeature['properties']): string | null {
  if (typeof properties.precision !== 'string') return null;
  const trimmed = properties.precision.trim();
  if (trimmed.length === 0) return null;
  return capitalize(trimmed);
}

/** Uppercase mono kind slug for NarrativeCard kickers (e.g. `place` → `PLACE`). */
export function featureKindSlug(kind: string): string {
  const trimmed = kind.trim();
  if (trimmed.length === 0) return 'RECORD';
  return trimmed.toUpperCase();
}

/**
 * Labeled at-a-glance facts for the preview strip, in fixed order:
 * Era → Precision → Place. Omits rows with no value (never invents undated/place).
 */
export function featureAtAGlanceFacts(feature: PreviewMetaFeature): readonly AtAGlanceFact[] {
  const facts: AtAGlanceFact[] = [];
  const era = eraLabel(feature.properties);
  if (era) facts.push({ label: 'Era', value: era });
  const precision = precisionLabel(feature.properties);
  if (precision) facts.push({ label: 'Precision', value: precision });
  const place = placeLabel(feature.properties);
  if (place) facts.push({ label: 'Place', value: place });
  return facts;
}

/** Compact place · year (or kind · place) string for preview meta. */
export function featureMetaLine(feature: PreviewMetaFeature): string {
  const place = placeLabel(feature.properties);
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
