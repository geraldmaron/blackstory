/**
 * Non-state GeoJSON memorial-name points for the explore MapLibre plate.
 * Eligible full names spread organically across the national plate frame
 * (low-discrepancy + jitter — not a lattice) and stay outside US state bboxes
 * so land fills never cover a name. Labels are name-only; slight size/rotation
 * variance breaks the grid read. MapLibre collision prevents glyph overlap;
 * decade fade uses paint feature-state opacity.
 */
import { findUsStateForPoint } from '@repo/domain/map/geography';
import {
  MEMORIAL_NAMES_PLATE,
  MEMORIAL_NAMES_REQUIRED,
  isMemorialNamePlateEligible,
  type MemorialNameEntry,
} from '../../components/atmosphere/memorial-names';
import { hashString } from '../../components/atmosphere/hash';

export type MemorialNameFeatureProperties = {
  /** Stable id for MapLibre `promoteId` / feature-state. */
  readonly id: string;
  readonly name: string;
  readonly year: number;
  /** Floor year of the death decade (1994 → 1990). */
  readonly decadeStart: number;
  readonly ink: number;
  /** Per-feature label size (px); slight variance for collage texture. */
  readonly size: number;
  /** Degrees of label rotation — breaks horizontal row reading. */
  readonly rotate: number;
  /** Lower sorts first; MapLibre keeps higher sort-key when colliding. */
  readonly priority: number;
};

export type MemorialNameFeature = {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: {
    readonly type: 'Point';
    readonly coordinates: readonly [number, number];
  };
  readonly properties: MemorialNameFeatureProperties;
};

export type MemorialNameFeatureCollection = {
  readonly type: 'FeatureCollection';
  readonly features: readonly MemorialNameFeature[];
};

/** Compact base size — per-feature sizes jitter around this for texture. */
export const MEMORIAL_LABEL_TEXT_SIZE = 9;

/**
 * OpenFreeMap only ships Noto Sans Regular / Italic / Bold. Italic is the
 * only cut with memorial character (Regular reads as UI chrome).
 */
export const MEMORIAL_LABEL_TEXT_FONT = ['Noto Sans Italic'] as const;

/** Keep the range compact so collision can surface more of the archive. */
export const MEMORIAL_LABEL_SIZE_MIN = 7;
export const MEMORIAL_LABEL_SIZE_MAX = 10;

/**
 * National plate frame (padded CONUS + deep ocean margins). Names pack this
 * whole section — oceans and Canadian/Mexican fringe — everywhere except
 * US state land.
 */
const PLATE_FRAME = {
  west: -138.0,
  east: -58.0,
  south: 18.0,
  north: 54.0,
} as const;

/**
 * Soft geo packing only — kept tight so MapLibre can show denser fields.
 * Final non-overlap is symbol collision at paint time.
 */
const MIN_SEPARATION_DEG = 0.02;

const MAX_PLACEMENT_ATTEMPTS = 140;

/** Plastic constant — 2D low-discrepancy sequence (R2). */
const PLASTIC = 1.324717957244746;

function unit(seed: string): number {
  return hashString(seed) / 0xffffffff;
}

/** Decade floor for a calendar year (1994 → 1990). */
export function memorialDecadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

export function memorialFeatureId(entry: MemorialNameEntry): string {
  return `memorial:${entry.name}:${entry.year}`;
}

function tooClose(
  lng: number,
  lat: number,
  placed: readonly { readonly lng: number; readonly lat: number }[],
): boolean {
  for (const other of placed) {
    const dx = lng - other.lng;
    const dy = (lat - other.lat) * 1.15;
    if (Math.hypot(dx, dy) < MIN_SEPARATION_DEG) return true;
  }
  return false;
}

/** True when the candidate sits inside any US state (+ DC) bbox — treat as land. */
export function isMemorialAnchorOnStateLand(lng: number, lat: number): boolean {
  return findUsStateForPoint(lat, lng) !== undefined;
}

/**
 * Organic plate sample: low-discrepancy R2 walk + hash jitter.
 * Fills the frame evenly without the row/column lattice that reads as a grid.
 */
function samplePlatePoint(
  seedKey: string,
  index: number,
  attempt: number,
): { readonly lng: number; readonly lat: number } {
  const width = PLATE_FRAME.east - PLATE_FRAME.west;
  const height = PLATE_FRAME.north - PLATE_FRAME.south;
  const n = index * 97 + attempt * 13 + 1;
  const u = (n * PLASTIC) % 1;
  const v = (n * PLASTIC * PLASTIC) % 1;
  // Stronger jitter on later attempts so rejects wander off any residual pattern.
  const jitterScale = 0.08 + Math.min(attempt, 40) * 0.012;
  const jx = (unit(`memorial-jx:${seedKey}:${index}:${attempt}`) - 0.5) * 2 * jitterScale;
  const jy = (unit(`memorial-jy:${seedKey}:${index}:${attempt}`) - 0.5) * 2 * jitterScale;
  const uu = (((u + jx) % 1) + 1) % 1;
  const vv = (((v + jy) % 1) + 1) % 1;
  return {
    lng: PLATE_FRAME.west + uu * width,
    lat: PLATE_FRAME.south + vv * height,
  };
}

/**
 * Full archive order: required names first, then seed-stable walk of the pool.
 * Default count is the entire eligible pool so decade fades work through every name.
 */
function selectPlateNames(
  seedKey: string,
  count: number,
  pool: readonly MemorialNameEntry[],
): readonly MemorialNameEntry[] {
  const eligible = pool.filter(isMemorialNamePlateEligible);
  const byKey = new Map(eligible.map((entry) => [`${entry.name}|${entry.year}`, entry]));
  const out: MemorialNameEntry[] = [];
  const seen = new Set<string>();

  for (const required of MEMORIAL_NAMES_REQUIRED) {
    const match = eligible.find((entry) => entry.name === required);
    if (!match) continue;
    const key = `${match.name}|${match.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(match);
    if (out.length >= count) return out;
  }

  const start = hashString(`memorial-plate:${seedKey}`) % Math.max(1, eligible.length);
  for (let i = 0; i < eligible.length && out.length < count; i += 1) {
    const entry = eligible[(start + i) % eligible.length]!;
    const key = `${entry.name}|${entry.year}`;
    if (seen.has(key) || !byKey.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

/**
 * Build the plate memorial FeatureCollection for the full eligible archive.
 * Anchors are seed-stable; decade fade mutates feature-state, not geometry.
 * Canvas labels are name-only — year stays in properties for decade coupling.
 */
export function buildMemorialNameFeatures(options?: {
  readonly seedKey?: string;
  readonly count?: number;
  readonly pool?: readonly MemorialNameEntry[];
}): MemorialNameFeatureCollection {
  const seedKey = options?.seedKey ?? 'map-stage';
  const pool = options?.pool ?? MEMORIAL_NAMES_PLATE;
  const eligible = pool.filter(isMemorialNamePlateEligible);
  const count = Math.min(
    Math.max(1, Math.floor(options?.count ?? eligible.length)),
    eligible.length,
  );

  const names = selectPlateNames(seedKey, count, eligible);
  const features: MemorialNameFeature[] = [];
  const placed: { readonly lng: number; readonly lat: number }[] = [];

  for (let i = 0; i < names.length; i += 1) {
    const entry = names[i]!;
    let point: { readonly lng: number; readonly lat: number } | null = null;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const candidate = samplePlatePoint(seedKey, i, attempt);
      if (isMemorialAnchorOnStateLand(candidate.lng, candidate.lat)) continue;
      if (tooClose(candidate.lng, candidate.lat, placed)) continue;
      point = candidate;
      break;
    }
    // Last resort: accept a non-land point even if close — screen collision
    // still prevents overlapping glyphs; better to keep the name in the set.
    if (!point) {
      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
        const candidate = samplePlatePoint(seedKey, i, attempt + 2000);
        if (isMemorialAnchorOnStateLand(candidate.lng, candidate.lat)) continue;
        point = candidate;
        break;
      }
    }
    if (!point) continue;

    const uInk = unit(`memorial-i:${seedKey}:${i}`);
    const uPri = unit(`memorial-p:${seedKey}:${i}`);
    const uSize = unit(`memorial-s:${seedKey}:${i}`);
    const uRot = unit(`memorial-r:${seedKey}:${i}`);
    // Soft ink — field should stay atmospheric, not compete with map labels or UI chrome.
    const ink = 0.12 + uInk * 0.14;
    // Size + rotation variance — collage texture, not a typeset grid.
    const size =
      MEMORIAL_LABEL_SIZE_MIN +
      Math.round(uSize * (MEMORIAL_LABEL_SIZE_MAX - MEMORIAL_LABEL_SIZE_MIN));
    // Modest tilt — enough to break rows without wasting collision slots.
    const rotate = Math.round((uRot - 0.5) * 2 * 16);
    // Newer deaths sort slightly higher so recent decades read first at mount.
    const priority = Math.floor(entry.year / 10) * 10 + Math.floor(uPri * 9);
    const id = memorialFeatureId(entry);
    placed.push(point);
    features.push({
      type: 'Feature',
      id,
      geometry: {
        type: 'Point',
        coordinates: [Math.round(point.lng * 1000) / 1000, Math.round(point.lat * 1000) / 1000],
      },
      properties: {
        id,
        name: entry.name,
        year: entry.year,
        decadeStart: memorialDecadeStart(entry.year),
        ink: Math.round(ink * 1000) / 1000,
        size,
        rotate,
        priority,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}
