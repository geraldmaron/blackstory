/**
 * BB-054 / BB-090 public notabilityBasis renderer (BB-054 acceptance criterion 5). Renders an
 * entity's structured `NotabilityBasisRecord[]` (../entity-status.js) into the auditable public
 * shape the "why this appears" surface renders — a short approved-language criterion label, the
 * full reviewable rubric sentence (`NOTABILITY_RUBRIC`, ../entity-status.js), the reviewer's
 * entity-specific note, and the record's `evidenceIds` for traceability. It never renders, derives,
 * or accepts a numeric score — composes `NOTABILITY_RUBRIC` and the existing publish gate
 * (./notability-gate.js); it does not reimplement either.
 */
import type { NotabilityBasisRecord, NotabilityCriterion } from '../entity-status.js';
import { NOTABILITY_RUBRIC } from '../entity-status.js';

/** Short approved-language label per criterion — the exact BB-090 `NOTABILITY_CRITERIA`
 * vocabulary (../entity-status.js), never a raw enum token in public copy. */
export const NOTABILITY_CRITERION_LABELS: Readonly<Record<NotabilityCriterion, string>> = {
  first_to_do_x: 'Documented first',
  major_honor_or_hall_of_fame: 'Major honor or hall of fame',
  landmark_or_national_register: 'Landmark or national register',
  court_precedent: 'Court precedent',
  movement_significance: 'Movement significance',
  documented_site: 'Documented site',
  community_anchor: 'Community anchor',
  only_or_oldest: 'Only or oldest of its kind',
};

export type PublicNotabilityBasisItem = {
  readonly criterion: NotabilityCriterion;
  readonly criterionLabel: string;
  readonly rubric: string;
  readonly note: string;
  /** Traceable, auditable evidence reference ids — never a numeric weight or score. */
  readonly evidenceIds: readonly string[];
};

export function buildPublicNotabilityBasis(
  basis: readonly NotabilityBasisRecord[] | undefined,
): readonly PublicNotabilityBasisItem[] {
  return (basis ?? []).map((record) => ({
    criterion: record.criterion,
    criterionLabel: NOTABILITY_CRITERION_LABELS[record.criterion],
    rubric: NOTABILITY_RUBRIC[record.criterion],
    note: record.note,
    evidenceIds: record.evidenceIds,
  }));
}

const BANNED_SCORE_SUBSTRINGS = ['score', 'weight', 'ranking', 'percentile'] as const;

/**
 * Defense-in-depth structural + textual scan: throws if any rendered basis item ever exposes a
 * score-shaped key or the word "score"/"weight"/"ranking"/"percentile" anywhere in its serialized
 * form. Mirrors the standing-policy check in ./notability-gate.test.ts and ./why.ts's
 * `assertExplanationHasNoNumericScore` at this module's own boundary.
 */
export function assertPublicNotabilityBasisNeverScored(
  items: readonly PublicNotabilityBasisItem[],
): void {
  const serialized = JSON.stringify(items).toLowerCase();
  for (const banned of BANNED_SCORE_SUBSTRINGS) {
    if (serialized.includes(banned)) {
      throw new Error(
        `Public notabilityBasis rendering must never expose "${banned}" — the auditable basis is ` +
          'a rubric label, note, and evidence references only, never a score.',
      );
    }
  }
}
