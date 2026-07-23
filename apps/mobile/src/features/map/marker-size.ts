/**
 * Data-driven marker radius for the native Explore map.
 * Parallels `apps/web/src/lib/map-experience/marker-size.ts` including county-proportionate
 * zoom scaling so national-view pins do not read as chunky blobs.
 */
export type ConfidenceTierLike = 'high' | 'medium' | 'low' | 'unrated' | (string & {});

export const MARKER_RADIUS_MIN = 4;
export const MARKER_RADIUS_MAX = 11;
export const MARKER_RADIUS_BASE = 4;
export const MARKER_RADIUS_EVIDENCE_COEFFICIENT = 1.6;
export const MARKER_HALO_OFFSET = 3;

export const CONFIDENCE_SIZE_MODIFIER: Readonly<
  Record<'high' | 'medium' | 'low' | 'unrated', number>
> = {
  high: 1.0,
  medium: 0.9,
  low: 0.8,
  unrated: 0.8,
};

/** Zoom-keyed scale — shrinks at national frame, identity at state, presence at locality. */
export const MARKER_ZOOM_SCALE_STOPS: ReadonlyArray<readonly [zoom: number, scale: number]> = [
  [3, 0.4],
  [5.5, 0.85],
  [9, 1.15],
  [12, 1.25],
];

function confidenceModifierFor(tier: ConfidenceTierLike): number {
  return (
    CONFIDENCE_SIZE_MODIFIER[tier as keyof typeof CONFIDENCE_SIZE_MODIFIER] ??
    CONFIDENCE_SIZE_MODIFIER.unrated
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function evidenceBaseRadius(evidenceCount: number): number {
  const safeCount = Number.isFinite(evidenceCount) ? Math.max(0, evidenceCount) : 0;
  return MARKER_RADIUS_BASE + Math.log2(1 + safeCount) * MARKER_RADIUS_EVIDENCE_COEFFICIENT;
}

export function markerRadius(evidenceCount: number, confidenceTier: ConfidenceTierLike): number {
  const unclamped = evidenceBaseRadius(evidenceCount) * confidenceModifierFor(confidenceTier);
  return clamp(unclamped, MARKER_RADIUS_MIN, MARKER_RADIUS_MAX);
}

export function markerHaloRadius(
  evidenceCount: number,
  confidenceTier: ConfidenceTierLike,
): number {
  return markerRadius(evidenceCount, confidenceTier) + MARKER_HALO_OFFSET;
}

export function markerZoomScale(zoom: number): number {
  const stops = MARKER_ZOOM_SCALE_STOPS;
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (zoom <= first[0]) return first[1];
  if (zoom >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i += 1) {
    const [z1, s1] = stops[i]!;
    const [z0, s0] = stops[i - 1]!;
    if (zoom <= z1) {
      return s0 + ((zoom - z0) / (z1 - z0)) * (s1 - s0);
    }
  }
  return last[1];
}

export function markerRadiusAtZoom(
  evidenceCount: number,
  confidenceTier: ConfidenceTierLike,
  zoom: number,
): number {
  return markerRadius(evidenceCount, confidenceTier) * markerZoomScale(zoom);
}

export const MARKER_RADIUS_EVIDENCE_STOPS: ReadonlyArray<
  readonly [evidenceCount: number, radius: number]
> = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256].map(
  (count) => [count, evidenceBaseRadius(count)] as const,
);

export function markerRadiusEvidenceExpression(): readonly unknown[] {
  const stops = MARKER_RADIUS_EVIDENCE_STOPS.flatMap(([count, radius]) => [count, radius]);
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', 'evidenceCount'], 0],
    ...stops,
  ] as const;
}

export function confidenceSizeModifierExpression(): readonly unknown[] {
  return [
    'match',
    ['coalesce', ['get', 'confidenceTier'], 'unrated'],
    'high',
    CONFIDENCE_SIZE_MODIFIER.high,
    'medium',
    CONFIDENCE_SIZE_MODIFIER.medium,
    'low',
    CONFIDENCE_SIZE_MODIFIER.low,
    CONFIDENCE_SIZE_MODIFIER.unrated,
  ] as const;
}

function markerDataRadiusExpression(): readonly unknown[] {
  return [
    'max',
    MARKER_RADIUS_MIN,
    [
      'min',
      MARKER_RADIUS_MAX,
      ['*', markerRadiusEvidenceExpression(), confidenceSizeModifierExpression()],
    ],
  ] as const;
}

function zoomScaledRadiusExpression(
  build: (dataRadius: readonly unknown[], scale: number) => unknown,
): readonly unknown[] {
  const stops = MARKER_ZOOM_SCALE_STOPS.flatMap(([zoom, scale]) => [
    zoom,
    build(markerDataRadiusExpression(), scale),
  ]);
  return ['interpolate', ['linear'], ['zoom'], ...stops] as const;
}

export function markerRadiusExpression(): readonly unknown[] {
  return zoomScaledRadiusExpression((dataRadius, scale) => ['*', dataRadius, scale]);
}

export function markerRadiusPlusExpression(offset: number): readonly unknown[] {
  return zoomScaledRadiusExpression((dataRadius, scale) => [
    '+',
    ['*', dataRadius, scale],
    offset,
  ]);
}

export function markerHaloRadiusExpression(): readonly unknown[] {
  return markerRadiusPlusExpression(MARKER_HALO_OFFSET);
}
