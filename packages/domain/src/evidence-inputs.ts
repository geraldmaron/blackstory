/**
 * The grading INPUTS a record's claims reduce to, projected for the search index.
 *
 * `@repo/domain` must not depend on `@repo/public-contracts` (workspace dependency direction,
 * `docs/decisions-carryover.md`), so this package cannot call the reader-facing tier rule. It
 * therefore stores the inputs to that rule instead of a derived tier in `search_index.facets`.
 *
 * So this module does not grade anything. It projects the FACTS grading needs — which levels are
 * present, which lineages are cited, which of those carry a claim that is not the record's own
 * index row — and `confidenceTierFromEvidenceInputs` in `@repo/public-contracts/evidence` turns
 * them into a tier at read time, on every surface including `/records`. One rule, one
 * implementation, with no cached tier that a rule change can strand.
 *
 * What remains duplicated across the boundary is the lineage-key normalization below, which
 * mirrors `citationLineageKey`. That is identity normalization, not grading: it decides which
 * citations are the same publisher, never which publisher counts.
 * `apps/web/src/lib/evidence/confidence-rule-parity.test.ts` compares the two projections
 * directly, so a divergence fails rather than ships.
 */

/** Claim level as the archive stores it, plus the absent case. */
export type EvidenceClaimLevel = 'high' | 'medium' | 'low' | 'unrated';

/**
 * The cached shape. Mirrors `RecordEvidenceInputs` in `@repo/public-contracts/evidence`
 * structurally, which is what lets a search doc be handed straight to the rule.
 */
export type RecordEvidenceInputs = {
  /** Strongest claim level on the record, before any corroboration cap. */
  readonly strongestClaimLevel: EvidenceClaimLevel;
  /** Every distinct lineage cited on the record — provenance rows and Wikipedia included. */
  readonly citedLineageKeys: readonly string[];
  /** The subset cited by at least one claim that is NOT the record's own index row. */
  readonly evidenceLineageKeys: readonly string[];
};

/** Enough of a claim to project. Every stored and wire claim shape satisfies it. */
export type EvidenceInputClaim = {
  readonly confidenceLevel?: string | undefined;
  readonly citationSource?: string | undefined;
  readonly citation?: { readonly source?: string | undefined } | undefined;
  /** Whether this claim is the record's own index row or evidence about its subject. */
  readonly claimRole?: string | undefined;
};

/** The Wikipedia family collapses to one key; syndicated copies count once. */
export const WIKIPEDIA_LINEAGE_KEY = 'wikipedia';

/** The claim is the record's own index row, not a source about its subject. */
export const CLAIM_ROLE_RECORD_INDEX = 'record_index';

/**
 * The lineage a citation belongs to.
 *
 * The source string is not a reliable identity on its own: the archive stores one publisher under
 * several spellings (`wikipedia_api`, `wikipedia.org`, `en.wikipedia.org`, `en.m.wikipedia.org`).
 * Subdomain prefixes are dropped and the Wikipedia family collapses to one key, matching the
 * confidence engine's `lineageRootId`.
 */
function claimLineageKey(claim: EvidenceInputClaim): string | null {
  const raw = (claim.citationSource ?? claim.citation?.source ?? '').trim().toLowerCase();
  if (raw.length === 0) return null;
  if (raw.includes('wikipedia') || raw.includes('wikidata')) return WIKIPEDIA_LINEAGE_KEY;
  return raw.replace(/^(?:www|en|en\.m|m)\./u, '');
}

/**
 * True when a claim is the record's own index row rather than evidence about its subject.
 *
 * Published claims carry `claimRole`. A claim missing it is treated as evidence rather than
 * inferred from its predicate, so this projection cannot silently classify a claim by wording.
 */
function isRecordIndexClaim(claim: EvidenceInputClaim): boolean {
  return (claim.claimRole ?? '').trim().toLowerCase() === CLAIM_ROLE_RECORD_INDEX;
}

/** Reduces a record's claims to the facts grading needs. Projection only — no grading rule. */
export function recordEvidenceInputs(claims: readonly EvidenceInputClaim[]): RecordEvidenceInputs {
  const cited = new Set<string>();
  const evidence = new Set<string>();
  for (const claim of claims) {
    const key = claimLineageKey(claim);
    if (key === null) continue;
    cited.add(key);
    if (!isRecordIndexClaim(claim)) evidence.add(key);
  }
  const strongestClaimLevel: EvidenceClaimLevel = claims.some(
    (claim) => claim.confidenceLevel === 'high',
  )
    ? 'high'
    : claims.some((claim) => claim.confidenceLevel === 'medium')
      ? 'medium'
      : claims.some((claim) => claim.confidenceLevel === 'low')
        ? 'low'
        : 'unrated';
  return {
    strongestClaimLevel,
    citedLineageKeys: [...cited],
    evidenceLineageKeys: [...evidence],
  };
}
