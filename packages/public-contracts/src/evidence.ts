/**
 * Evidence semantics — the one language both platforms speak about how well a record is
 * supported.
 *
 * The archive stores confidence as `high` / `medium` / `low` / `unrated`. Readers see a
 * three-segment meter, a letter, and a sentence. Those are spellings of one fact, and this module
 * owns the mapping so the site and the app cannot drift.
 *
 * It used to live in `apps/web/src/lib/map-experience/evidence-grade.ts`, where the phone could
 * not reach it. Native surfaces therefore invented their own vocabulary — "High confidence" as a
 * plain fact-strip string — while the site showed a graded meter, so the same record read as two
 * different assessments depending on which screen you opened.
 *
 * Two rules the whole product depends on:
 *
 * - `unrated` has no letter and no filled segment. A record nobody assessed is not a D. Inventing
 *   a fourth grade for it presents absence of assessment as a low assessment.
 * - The meter is never the only cue. Every renderer pairs it with the letter or the sentence,
 *   because colour alone is not information.
 */

import type { ConfidenceTierV1 } from './v1/map.js';

export type ConfidenceTier = ConfidenceTierV1;

export type EvidenceGrade = 'A' | 'B' | 'C';

/** The floor a reader can set. `any` admits ungraded records; a letter does not. */
export type EvidenceFloor = 'any' | EvidenceGrade;

export const EVIDENCE_FLOORS: readonly EvidenceFloor[] = ['any', 'C', 'B', 'A'];

/** Segments in the canonical meter. Three, on every surface and both platforms. */
export const EVIDENCE_METER_SEGMENTS = 3;

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

/** Filled segments for a confidence tier. Unrated is honestly empty, never a fourth colour. */
export function meterLevelForTier(tier: ConfidenceTier | string): number {
  switch (tier) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function meterLevelForCoverage(level: 'minimal' | 'partial' | 'substantial'): number {
  switch (level) {
    case 'substantial':
      return 3;
    case 'partial':
      return 2;
    default:
      return 1;
  }
}

/**
 * The sentence a screen reader hears in place of the bars.
 *
 * The count is appended only when the surface actually knows it. A record whose source count is
 * unavailable says nothing about sources rather than saying zero, because "0 sources" and "we did
 * not load the sources" are different claims and only one of them is true.
 */
export function evidenceMeterLabel(tier: ConfidenceTier | string, sourceCount?: number): string {
  const base = gradeDescription(gradeForConfidence(tier));
  if (typeof sourceCount !== 'number' || !Number.isFinite(sourceCount) || sourceCount < 0) {
    return base;
  }
  return `${base}, ${sourceCount === 1 ? '1 source' : `${sourceCount} sources`}`;
}

/**
 * The visible evidence label: "Grade A · 2 sources", or "Not graded" when nobody assessed it.
 *
 * Both platforms print this string. The web record sheet builds it and then splits it back apart
 * with `evidenceGradeWord` / `evidenceCountPhrase`, which only works while there is exactly one
 * way to build it.
 */
export function evidenceLabel(tier: ConfidenceTier | string, sourceCount?: number): string {
  const grade = gradeForConfidence(tier);
  const head = grade === null ? 'Not graded' : `Grade ${grade}`;
  if (typeof sourceCount !== 'number' || !Number.isFinite(sourceCount) || sourceCount < 0) {
    return head;
  }
  return `${head} · ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`;
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
 * The floor is applied as its own predicate rather than through an exact-match `confidence` facet.
 * Routing "B and up" through an exact match would silently drop every grade A record — the
 * opposite of what the reader asked for.
 */
export function applyEvidenceFloor<
  T extends { readonly properties: { readonly confidenceTier: ConfidenceTier } },
>(features: readonly T[], floor: EvidenceFloor): readonly T[] {
  if (floor === 'any') return features;
  return features.filter((feature) => meetsEvidenceFloor(feature.properties.confidenceTier, floor));
}
