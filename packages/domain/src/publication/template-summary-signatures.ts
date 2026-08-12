/**
 * Fingerprints of summary prose that was ASSEMBLED FROM A REGISTRY INDEX ROW rather than written
 * from a fetched source — the fixed sentences a roster importer appends to every record it
 * generates, most often purely to clear the 120-char projection floor.
 *
 * These lived next to their generator (`ops-data/scripts/lib/nrhp-area-labels.ts`) when the depth
 * gate was their only other reader. They are here now because a THIRD reader needs them and sits
 * underneath both: `computeReleaseResearchCoverage` in `release-builder.ts`, which must refuse to
 * publish templated prose above 'minimal' no matter which build path produced it (repo-vymq).
 * `@repo/domain` is the only layer all three can import, and a second copy of these strings is
 * exactly the drift the original co-location argument was written to prevent — so the generator
 * now re-exports these rather than owning them.
 *
 * repo-z1pw is the failure this guards against. The nrhp-black-heritage lane synthesizes two
 * claims — a listing fact and a significance fact — from one spreadsheet line, and 2,436 live
 * records published as 'partial' on that basis. `isThinRecord()` (apps/web) keys strictly on
 * 'minimal', so the registry-listing disclosure never fired for the population it was written for
 * and readers saw an uncaveated description of a history nobody had researched.
 *
 * A match here is proof of a template, not evidence of one: the strings are emitted verbatim by a
 * generator, so a substring hit cannot be a coincidence of ordinary prose.
 *
 * ADDING A LANE: append its generated sentences here, in the exact form the generator emits them
 * (trimmed). Do not add a phrase that a human writer might plausibly produce — the match is
 * treated as conclusive, and a false positive silently caps a genuinely researched record.
 */

/**
 * The two fixed sentences `backfill-nrhp-black-heritage-summaries.ts` appends to every summary it
 * generates. Leading space included: they are concatenated onto a preceding sentence.
 */
export const NRHP_SUMMARY_TRAILER =
  ` The National Park Service's National Register program recognizes it as a documented site of ` +
  `African American historical importance.`;

export const NRHP_SUMMARY_FILLER =
  ` It is one of thousands of properties nationwide the National Register has formally recognized ` +
  `for preserving African American history and heritage.`;

/** Every known generated-summary fingerprint, in the form consumers substring-match. */
export const LANE_TEMPLATE_SIGNATURES: readonly string[] = [
  NRHP_SUMMARY_TRAILER.trim(),
  NRHP_SUMMARY_FILLER.trim(),
];

/**
 * The registered fingerprint a summary carries, or `null` if it carries none.
 *
 * Returns the matched phrase rather than a boolean so callers can say WHICH template they matched
 * in an audit line or a gate rejection detail — the depth gate's `template_only` message and this
 * module's coverage cap both quote it.
 */
export function findTemplateSummarySignature(summary: string): string | null {
  return LANE_TEMPLATE_SIGNATURES.find((phrase) => summary.includes(phrase)) ?? null;
}
