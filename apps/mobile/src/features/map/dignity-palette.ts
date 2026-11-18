/**
 * Map colors for kind encoding, semantic tones and cluster sizing.
 *
 * The plate roles (land, water, boundaries, labels, halo) are the web `--ds-map-*` roles,
 * generated into `mapColors`; the map plate stays on the dark register in both themes.
 * Kind and tone shades have no token: they mirror `DIGNITY_PALETTE` in
 * `apps/web/src/lib/map-experience/dignity-style.ts` and must be changed there first.
 * Confidence colors are the themed `confidenceColors` tokens, not declared here.
 */
import { brandCore, mapColors } from '@/ui';

const PLATE = mapColors.dark;

export const CLUSTER_RADIUS_BY_COUNT: readonly (readonly [minCount: number, radius: number])[] = [
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
  /** Rim / secondary contrast on dark plate (Archive Paper). */
  selected: brandCore.archivePaper,
  /** Copper orientation ring for the selected pin (web Explore parity). */
  selectedAccent: brandCore.copperPin,
  /**
   * Land plate. OpenMapTiles has no full-land polygon, so background = land and water
   * polygons = ocean; the web contract keeps land clearly lighter than water.
   */
  land: PLATE.land,
  ocean: PLATE.water,
  /** Sand hairline on water polygon outlines — orientation, not glow. No web role. */
  coastline: 'rgba(216, 161, 120, 0.45)',
  stateBounds: PLATE.line,
  /** Streets mirror web dignity-style `street*Dark` (paper at low alpha), not a plate role. */
  streetCasing: 'rgba(244, 239, 229, 0.22)',
  street: 'rgba(244, 239, 229, 0.38)',
  streetLabel: 'rgba(244, 239, 229, 0.55)',
  /** State labels. */
  placeLabel: PLATE.label,
  /** City and town labels. */
  placeLabelHi: PLATE.labelHi,
  /** Halo matches land plate so state labels sit on CONUS, not the ocean void. */
  placeLabelHalo: PLATE.halo,
  kindPerson: brandCore.copperPin,
  kindPlace: '#E09A55',
  kindSchool: '#7A8B52',
  kindOrganization: '#9A5828',
  kindInstitution: '#8B7355',
  kindInstitutionStroke: '#C9BA9A',
  kindEvent: '#D07A32',
  kindLaw: '#356494',
  kindCase: '#7BA8D4',
  kindPublication: '#5C6B4E',
  kindArtifact: '#A68968',
  kindInvention: '#6BA894',
  kindMovement: '#C4683A',
  kindOther: '#6D675F',
  kindMassacre: '#B83A2A',
  kindPlantation: '#2C2824',
  kindEpicenter: '#C9A227',
} as const;

export const CONFIDENCE_TIER_GLYPH: Readonly<Record<string, string>> = {
  high: '●',
  medium: '◐',
  low: '○',
  unrated: '·',
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
    ['*', step, 0.55],
    5.5,
    ['*', step, 0.9],
    9,
    step,
  ] as const;
}
