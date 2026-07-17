/**
 * Fail-closed citation-completeness gate for projection build (BB-083 acceptance criterion 1).
 *
 * "Unsourced" must never be a publishable state: every published claim needs at least one
 * structurally complete citation (source name, URL-or-offline-designation, capture pointer,
 * retrieval date — see ./citation.ts). This module is the gate; it does not decide *when*
 * projection build runs.
 *
 * INTEGRATION POINT (documented, not live-wired — matching this session's established pattern
 * for wiring that is genuinely out of this bead's file-ownership/risk budget; see
 * packages/domain/src/map/map-source.ts's "INTEGRATION POINT" comment for the same convention):
 *
 * The actual claim -> public-projection assembly step that ultimately calls
 * `buildReleaseManifest` (packages/domain/src/publication/index.ts) lives outside this TS
 * package for the *primary* publish path — per ADR-007, worker code (including the
 * projection-build pipeline) lives in workers/publication/ (Python), not packages/domain. The
 * one call site to `buildReleaseManifest` that does exist in this TS package,
 * `retractResearchCase` in packages/domain/src/research-case/workflow.ts (owned by other beads
 * this session, not touched here), assembles `ReleaseArtifact[]` immediately before that call.
 *
 * The integration point for both the Python pipeline and any future TS caller is identical:
 * call `assertProjectionCitationCompletenessGate` with every claim slated for this projection
 * build and a `claimId -> Citation[]` map immediately before `buildReleaseManifest` (or its
 * Python equivalent) runs, and do not proceed to build/activate the release if it throws.
 * Because the gate fails closed (throws rather than returning a boolean the caller could
 * ignore), wiring it in is a single guarded call, not a refactor.
 */
import type { Citation } from './citation.js';
import { isCitationStructurallyComplete } from './citation.js';

export type CitationCompletenessFailure = {
  readonly claimId: string;
  readonly reason: string;
};

export type CitationCompletenessResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: readonly CitationCompletenessFailure[] };

/**
 * A claim passes when at least one of its citations is structurally complete. Citations that
 * exist but are incomplete (e.g. missing a capture pointer) do not count — "some citation
 * object exists" is not the bar; "at least one *complete* citation" is.
 */
export function evaluateClaimCitationCompleteness(
  claim: { readonly id: string },
  citations: readonly Citation[],
): CitationCompletenessResult {
  const own = citations.filter((citation) => citation.claimId === claim.id);
  if (own.length === 0) {
    return {
      ok: false,
      failures: [{ claimId: claim.id, reason: 'no_citation' }],
    };
  }
  const hasComplete = own.some((citation) => isCitationStructurallyComplete(citation));
  if (!hasComplete) {
    return {
      ok: false,
      failures: [{ claimId: claim.id, reason: 'no_structurally_complete_citation' }],
    };
  }
  return { ok: true };
}

export function assertClaimCitationComplete(
  claim: { readonly id: string },
  citations: readonly Citation[],
): void {
  const result = evaluateClaimCitationCompleteness(claim, citations);
  if (!result.ok) {
    throw new Error(
      `Claim ${claim.id} cannot publish: ${result.failures.map((f) => f.reason).join(', ')}. ` +
        '"Unsourced" is not a publishable state (BB-083).',
    );
  }
}

/**
 * Evaluates every claim slated for a projection build. Aggregates all failures (rather than
 * stopping at the first) so a single build attempt surfaces the full unsourced-claim list.
 */
export function evaluateProjectionCitationCompleteness(
  claims: readonly { readonly id: string }[],
  citationsByClaimId: ReadonlyMap<string, readonly Citation[]>,
): CitationCompletenessResult {
  const failures: CitationCompletenessFailure[] = [];
  for (const claim of claims) {
    const result = evaluateClaimCitationCompleteness(claim, citationsByClaimId.get(claim.id) ?? []);
    if (!result.ok) {
      failures.push(...result.failures);
    }
  }
  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

/**
 * Fail-closed gate: call immediately before building/activating a projection release (see the
 * INTEGRATION POINT note above). Throws — never returns a value the caller could ignore — when
 * any claim lacks a structurally complete citation.
 */
export function assertProjectionCitationCompletenessGate(
  claims: readonly { readonly id: string }[],
  citationsByClaimId: ReadonlyMap<string, readonly Citation[]>,
): void {
  const result = evaluateProjectionCitationCompleteness(claims, citationsByClaimId);
  if (!result.ok) {
    const claimIds = [...new Set(result.failures.map((f) => f.claimId))];
    throw new Error(
      `Projection build blocked: ${claimIds.length} claim(s) lack a complete citation ` +
        `(${claimIds.join(', ')}). "Unsourced" is not a publishable state (BB-083).`,
    );
  }
}
