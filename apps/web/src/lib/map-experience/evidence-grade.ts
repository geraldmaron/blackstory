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

/*
 * The evidence count, one wording on every surface (record page, Explore inspector): every
 * accepted claim on the record and the distinct sources behind them, "5 claims from 5 sources".
 * `evidenceCount` and `sourceCount` on the map feature carry the same two numbers.
 */

type CitedClaim = {
  readonly citationHref?: string | undefined;
  readonly citationSource?: string | undefined;
  readonly citationLabel?: string | undefined;
};

/** The identity of the source a claim cites; empty when the claim names none. */
export function claimSourceKey(claim: CitedClaim): string {
  return (claim.citationHref ?? claim.citationSource ?? claim.citationLabel ?? '').trim();
}

export function countClaimSources(claims: readonly CitedClaim[]): number {
  return new Set(claims.map(claimSourceKey).filter((key) => key.length > 0)).size;
}

export function evidenceCountWords(claimCount: number, sourceCount: number): string {
  const noun = (count: number, word: string) =>
    `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;
  return sourceCount > 0
    ? `${noun(claimCount, 'claim')} from ${noun(sourceCount, 'source')}`
    : noun(claimCount, 'claim');
}
