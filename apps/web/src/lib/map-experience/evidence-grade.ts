/**
 * Evidence grade — the reader-facing letter over the stored confidence tier.
 *
 * The archive stores confidence as `high` / `medium` / `low` / `unrated` (`build-explore-map-source.ts`)
 * and the v9 chrome shows it as a letter with a grade dot (design-direction-v9-atlas.md §5.3, §8).
 * Those are two spellings of one fact, so the mapping lives here once rather than being re-derived
 * in the lens, the rail, the sheet and the citation.
 *
 * `unrated` deliberately has no letter. A record whose claims were never graded is not a D — it is
 * a record nobody has assessed, and inventing a fourth grade for it would present absence of
 * assessment as a low assessment.
 */

import type { ConfidenceTier } from './build-explore-map-source';

export type EvidenceGrade = 'A' | 'B' | 'C';

/** The floor a reader can set in the lens. `any` admits ungraded records; a letter does not. */
export type EvidenceFloor = 'any' | EvidenceGrade;

export const EVIDENCE_FLOORS: readonly EvidenceFloor[] = ['any', 'C', 'B', 'A'];

const GRADE_BY_TIER: Readonly<Record<ConfidenceTier, EvidenceGrade | null>> = {
  high: 'A',
  medium: 'B',
  low: 'C',
  unrated: null,
};

/** Rank used for floor comparison. Higher is stronger. */
const GRADE_RANK: Readonly<Record<EvidenceGrade, number>> = { C: 1, B: 2, A: 3 };

export function gradeForConfidence(tier: ConfidenceTier | string): EvidenceGrade | null {
  return GRADE_BY_TIER[tier as ConfidenceTier] ?? null;
}

/** What the mono meta line prints. An em dash is banned in copy; this is a data placeholder. */
export function gradeLabel(grade: EvidenceGrade | null): string {
  return grade ?? '·';
}

/** Full phrase for `aria-label` and `title`, where a bare letter reads as noise. */
export function gradeDescription(grade: EvidenceGrade | null): string {
  return grade === null ? 'Evidence not graded' : `Evidence grade ${grade}`;
}

/** The floor chip's own label. */
export function floorLabel(floor: EvidenceFloor): string {
  if (floor === 'any') return 'Any';
  if (floor === 'A') return 'A only';
  return `${floor} and up`;
}

/**
 * Does a record clear the floor? `any` admits everything including ungraded records; any letter
 * floor excludes ungraded ones, because a floor is a claim about assessed strength and an
 * unassessed record cannot satisfy it.
 */
export function meetsEvidenceFloor(tier: ConfidenceTier | string, floor: EvidenceFloor): boolean {
  if (floor === 'any') return true;
  const grade = gradeForConfidence(tier);
  if (grade === null) return false;
  return GRADE_RANK[grade] >= GRADE_RANK[floor];
}

/**
 * The floor is applied as its own predicate rather than through the existing `confidence` facet.
 * That facet is an exact match by design (`applyExploreFilters`), so routing "B and up" through it
 * would silently drop every grade A record — the opposite of what the reader asked for.
 */
export function applyEvidenceFloor<
  T extends { readonly properties: { readonly confidenceTier: ConfidenceTier } },
>(features: readonly T[], floor: EvidenceFloor): readonly T[] {
  if (floor === 'any') return features;
  return features.filter((feature) => meetsEvidenceFloor(feature.properties.confidenceTier, floor));
}
