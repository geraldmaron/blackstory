/**
 * Memorial name wall data — verified Black lives lost to police/state violence
 * or racial terror, for the map-atmosphere collage. Context strings are memorial
 * labels, not legal findings. See docs/research/memorial-names-wall.sources.json.
 */
import memorialNamesJson from './memorial-names.json';
import { hashString } from './hash';

export type MemorialNameCategory = 'police_violence' | 'racial_terror' | 'state_execution';

export type MemorialNameEntry = {
  readonly name: string;
  readonly year: number;
  readonly category: MemorialNameCategory;
  readonly place?: string;
  readonly context?: string;
};

export const MEMORIAL_NAMES = memorialNamesJson as readonly MemorialNameEntry[];

/** Names the product owner asked to keep visible in the wall set. */
export const MEMORIAL_NAMES_REQUIRED = [
  'Emmett Till',
  'Breonna Taylor',
  'Eric Garner',
  'Amadou Diallo',
  'Sean Bell',
  'Nat Turner',
] as const;

/**
 * Plate-worthy memorial names need a given name + family name (or equivalent).
 * Single-token entries ("Adam", "Jim") read as incomplete on the memorial field.
 */
export function isMemorialNamePlateEligible(entry: MemorialNameEntry): boolean {
  const parts = entry.name
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^["']+|["']+$/g, ''))
    .filter((token) => /[A-Za-z]/.test(token));
  return parts.length >= 2;
}

/** Archive entries eligible for the map memorial field (full name present). */
export const MEMORIAL_NAMES_PLATE: readonly MemorialNameEntry[] = MEMORIAL_NAMES.filter(
  isMemorialNamePlateEligible,
);

/**
 * Seed-stable window into the memorial pool (no duplicates within the window).
 * Rotates through the full list so larger viewports and swaps can surface more lives.
 */
export function selectMemorialNames(
  seedKey: string,
  count: number,
  pool: readonly MemorialNameEntry[] = MEMORIAL_NAMES,
): readonly MemorialNameEntry[] {
  if (pool.length === 0 || count <= 0) return [];
  const density = Math.min(count, pool.length);
  const start = hashString(`memorial-names:${seedKey}`) % pool.length;
  const out: MemorialNameEntry[] = [];
  for (let i = 0; i < density; i += 1) {
    out.push(pool[(start + i) % pool.length]!);
  }
  return out;
}

/** One-line dignity label: PERSON · YEAR · PLACE when place is known. */
export function memorialNameLabel(entry: MemorialNameEntry): string {
  const place = entry.place?.trim();
  return place ? `${entry.name} · ${entry.year} · ${place}` : `${entry.name} · ${entry.year}`;
}
