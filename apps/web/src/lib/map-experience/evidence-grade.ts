/**
 * Evidence grade — the reader-facing letter over the stored confidence tier.
 *
 * The semantics moved to `@repo/public-contracts/evidence` so the native app reads the same
 * mapping instead of inventing its own confidence vocabulary. This module stays as the web's
 * import path, and keeps the two helpers that are about a label *this app builds* rather than
 * about the grade itself.
 */

export {
  EVIDENCE_FLOORS,
  EVIDENCE_METER_SEGMENTS,
  applyEvidenceFloor,
  evidenceLabel,
  evidenceMeterLabel,
  floorLabel,
  gradeDescription,
  gradeForConfidence,
  gradeLabel,
  meetsEvidenceFloor,
  meterLevelForCoverage,
  meterLevelForTier,
  type EvidenceFloor,
  type EvidenceGrade,
} from '@repo/public-contracts/evidence';

/*
 * An evidence label is built as "<grade word> · <count>" — "Grade A · 2 sources". Three surfaces
 * (record sheet, narrative card, book record panel) print the grade and the count separately, so
 * the split lives here rather than being re-derived with a different `split()` in each of them.
 */

/** "Grade A · 2 sources" → "Grade A". Returns the whole label when there is no count. */
export function evidenceGradeWord(evidenceLabel: string): string {
  return evidenceLabel.split(' · ')[0] ?? evidenceLabel;
}

/** "Grade A · 2 sources" → "2 sources". Undefined when the label carries no count. */
export function evidenceCountPhrase(evidenceLabel: string): string | undefined {
  const tail = evidenceLabel.split(' · ').slice(1).join(' · ').trim();
  return tail.length > 0 ? tail : undefined;
}
