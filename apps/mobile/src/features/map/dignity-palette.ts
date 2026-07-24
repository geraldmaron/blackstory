/**
 * Map color tokens for kind encoding, semantic tones, confidence, and cluster sizing.
 * Mirrors `apps/web/src/lib/map-experience/dignity-style.ts` — mobile map paint and
 * the Color key legend read from this module so they cannot drift from web v6.
 */
import { brandCore } from '@/ui';

export const CLUSTER_RADIUS_BY_COUNT: ReadonlyArray<readonly [minCount: number, radius: number]> = [
  [0, 10],
  [10, 14],
  [50, 18],
  [200, 22],
];

export const DIGNITY_PALETTE = {
  point: brandCore.copperPin,
  pointHalo: brandCore.sand,
  cluster: brandCore.mahogany,
  clusterText: brandCore.archivePaper,
  selected: brandCore.archivePaper,
  kindPerson: brandCore.copperPin,
  kindPlace: '#E09A55',
  kindSchool: '#7A8B52',
  kindOrganization: '#9A5828',
  kindInstitution: '#8B7355',
  kindInstitutionStroke: '#C9BA9A',
  kindEvent: '#8E4F2A',
  kindLaw: '#356494',
  kindCase: '#7BA8D4',
  kindPublication: '#5C6B4E',
  kindArtifact: '#A68968',
  kindMovement: '#C4683A',
  kindOther: '#6D675F',
  kindMassacre: '#8E4F2A',
  kindPlantation: '#2C2824',
  kindEpicenter: '#C9A227',
  confidenceHigh: '#2F6B3C',
  confidenceMedium: '#8B8A2E',
  confidenceLow: '#D07A32',
  confidenceUnrated: '#6D675F',
} as const;

export const CONFIDENCE_TIER_GLYPH: Readonly<Record<string, string>> = {
  high: '●',
  medium: '◐',
  low: '○',
  unrated: '·',
};

export const CONFIDENCE_TIER_COLOR: Readonly<Record<string, string>> = {
  high: DIGNITY_PALETTE.confidenceHigh,
  medium: DIGNITY_PALETTE.confidenceMedium,
  low: DIGNITY_PALETTE.confidenceLow,
  unrated: DIGNITY_PALETTE.confidenceUnrated,
};

/** Cluster count `step` at locality zoom (matches web explore-style). */
function clusterCountStepExpression(): readonly unknown[] {
  const [s0, s1, s2, s3] = CLUSTER_RADIUS_BY_COUNT;
  return [
    'step',
    ['get', 'point_count'],
    s0![1],
    s1![0],
    s1![1],
    s2![0],
    s2![1],
    s3![0],
    s3![1],
  ] as const;
}

/** @deprecated Use clusterRadiusZoomExpression — kept for tests referencing step-only shape. */
export function clusterRadiusStepExpression(): readonly unknown[] {
  return clusterCountStepExpression();
}

/** Cluster radius scaled by zoom (national shrink, locality full size). Web parity. */
export function clusterRadiusZoomExpression(): readonly unknown[] {
  const step = clusterCountStepExpression();
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    3,
    ['*', step, 0.45],
    5.5,
    ['*', step, 0.85],
    9,
    step,
  ] as const;
}
