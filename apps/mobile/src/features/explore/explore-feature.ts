/**
 * The Explore feature model (MOB-012): the shape the synchronized list, the
 * clustering logic, and the preview sheet all read.
 *
 * It is a thin, UI-facing projection of the ALREADY-REDACTED map source
 * (`features/map/demoMapSource.ts`, ADR-024 §10). This module adds NO geography
 * and NO precision: it only reshapes fields the list/sheet need and defensively
 * sanitizes the one attacker-influenced field — `displayName` — for rendering.
 * Coordinates are passed through byte-for-byte from the redacted source; nothing
 * here ever reads a coordinate back out to synthesize a new one.
 */
import type { LngLat } from '@/features/map/mapCamera';
import type {
  MapFeatureCollection,
  MapPointFeature,
  MapPointFeatureProperties,
} from '@/features/map/demoMapSource';

/**
 * Defensive ceiling on a rendered label. Entity display names ultimately derive
 * from published records, but the render layer must never assume they are bounded
 * — a pathological/hostile name (megabyte string, control chars, RTL-override
 * smuggling) must not overflow layout, wedge the text engine, or leak into logs.
 * 120 chars is well above any legitimate institution name.
 */
export const MAX_LABEL_LENGTH = 120;

/**
 * Makes an arbitrary label safe to render in a single-line row/sheet:
 *  - coerces non-strings to '' (never throws on hostile input),
 *  - strips ASCII control chars AND Unicode bidi-override/format chars that could
 *    reorder or mask surrounding text,
 *  - collapses runs of whitespace,
 *  - truncates to `MAX_LABEL_LENGTH` with an ellipsis.
 * Returns a non-empty fallback so a row is never blank/untappable.
 */
export function sanitizeLabel(raw: unknown, fallback = 'Untitled record'): string {
  if (typeof raw !== 'string') return fallback;
  let out = '';
  for (let i = 0; i < raw.length && out.length <= MAX_LABEL_LENGTH + 1; i += 1) {
    const code = raw.charCodeAt(i);
    // C0/C7 control chars.
    if (code < 0x20 || code === 0x7f) continue;
    // Bidi overrides/embeddings/isolates + zero-width/BOM (text-spoofing vectors).
    if (
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069) ||
      code === 0xfeff
    ) {
      continue;
    }
    out += raw[i];
  }
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length === 0) return fallback;
  if (out.length > MAX_LABEL_LENGTH) return `${out.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…`;
  return out;
}

export type ExploreFeatureProperties = MapPointFeatureProperties & {
  /** Optional era buckets for the era filter; absent in the base redacted source. */
  readonly eraBuckets?: readonly string[];
  /** Optional one-line summary shown in the preview sheet. */
  readonly oneLineStory?: string;
};

export type ExploreFeature = {
  readonly type: 'Feature';
  readonly id: string;
  readonly entityId: string;
  /** Sanitized, render-safe display name (never the raw label). */
  readonly label: string;
  readonly kind: string;
  /** Redacted coordinate, passed through unchanged from the source. */
  readonly coordinates: LngLat;
  readonly properties: ExploreFeatureProperties;
};

/** Human subtitle for a row: "Kind · State" when both are known. */
export function featureSubtitle(feature: ExploreFeature): string {
  const parts = [feature.properties.stateName, capitalize(feature.kind)].filter(
    (p): p is string => Boolean(p),
  );
  return parts.join(' · ');
}

function capitalize(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Projects a redacted map feature into an Explore feature. The coordinate is the
 * SAME array reference/values as the source — this function never rounds, jitters,
 * or otherwise alters it, so the redaction guarantee is preserved verbatim.
 */
export function toExploreFeature(feature: MapPointFeature): ExploreFeature {
  return {
    type: 'Feature',
    id: feature.id,
    entityId: feature.properties.entityId,
    label: sanitizeLabel(feature.properties.displayName),
    kind: feature.properties.kind,
    coordinates: feature.geometry.coordinates as LngLat,
    properties: feature.properties,
  };
}

export function toExploreFeatures(source: MapFeatureCollection): readonly ExploreFeature[] {
  return source.features.map(toExploreFeature);
}
