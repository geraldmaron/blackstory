/** Validate the complete session batch before database access or any ledger writes. */
export function assertSessionEnrichmentBatch(
  answers: readonly { readonly entityId: string }[],
  refusals: readonly { readonly entityId: string }[],
): void {
  if (answers.length === 0 && refusals.length === 0) {
    throw new Error('Session batch contained no answers or refusals');
  }
  const seen = new Set<string>();
  for (const row of [...answers, ...refusals]) {
    if (!row.entityId.trim()) throw new Error('Session batch contains an empty entityId');
    if (seen.has(row.entityId)) {
      throw new Error(
        `Session batch contains duplicate or conflicting outcome for ${row.entityId}`,
      );
    }
    seen.add(row.entityId);
  }
}

/** A terminal judgment requires a current captured subject, never an absent lookup result. */
export function canRecordSignificanceRefusal(
  reason: string,
  evidenceDigest: string | null | undefined,
  reviewedEvidenceDigest: string | null | undefined,
): boolean {
  return (
    typeof evidenceDigest === 'string' &&
    evidenceDigest.trim().length > 0 &&
    evidenceDigest === reviewedEvidenceDigest &&
    !/^\s*MIS-ATTACHED\b/iu.test(reason)
  );
}
