/**
 * Wires the REAL multi-factor confidence engine (packages/domain/src/claims/confidence.ts
 * — sourceAuthority + lineageIndependence + directness + temporalProximity +
 * geographicPrecision + entityMatchQuality + extractionQuality, weighted,
 * checked against the product constitution's publish thresholds) into the
 * corsair pipeline, replacing a cruder "every claim's citationHref must
 * literally be a .gov domain" binary check.
 *
 * The key behavior this restores: multiple INDEPENDENT sources (different
 * lineageRootId) corroborating the same subject raise confidence — a
 * Wikipedia-only claim caps at one lineage (component 0.4) and won't clear
 * standardPublish (0.75); the same claim WITH an independently-fetched Tier-1
 * corroborating source (two lineages, component 0.7, one of them
 * government_record-authority) can clear it. That is "use multiple sources
 * together to build confidence" as an actual formula, not a slogan.
 */
import {
  calculateClaimConfidence,
  resolveSourceLineage,
  type ClaimEvidenceLink,
  type ConfidenceEngineResult,
} from '@repo/domain';
import { isPatentDocumentUrl } from '@repo/domain-core/claims/lineage';
import { isReputableSecondaryHost, isTier1Host, isWikipediaHost } from './tier1-sources.ts';

/**
 * Host classification by comparison, not by regular expression.
 *
 * The `/\.gov$/iu`-style patterns here ran against a parsed hostname and were correct, but an
 * unanchored expression tested against a URL matches anywhere, which CodeQL cannot distinguish
 * (js/regex/missing-regexp-anchor). `hostUnderTld` and `hostMatches` say the rule outright.
 */
const GOVERNMENT_TLDS = ['gov', 'mil'];
const GOVERNMENT_DOMAINS = ['si.edu'];
const ARCHIVAL_DOMAINS = ['rosenwald.fisk.edu', 'archive.org'];

/**
 * Substrings of a *hostname label*, not of the whole URL. A newspaper's masthead shows up in
 * its domain (nytimes.com, chicagotribune.com), so the hint has to match inside a label rather
 * than against the whole name — but it is matched per label, so a path or query cannot smuggle
 * "times" into the decision.
 */
const NEWS_HOST_HINTS = ['news', 'times', 'post', 'tribune', 'gazette', 'herald'];

function hostUnderTld(hostname: string, tld: string): boolean {
  return hostname.endsWith(`.${tld}`);
}

function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * The display register a claim earns from its source alone.
 *
 * This replaces the publisher's binary `sourceTier === 'tier1' ? 'high' : 'medium'`, which never
 * emitted `low` and so rendered a three-segment meter from a two-value vocabulary: 10,572 of
 * 11,555 published claims were `high` and none were `low` (repo-hqwt9).
 *
 * - A government or military record is the archive's primary evidence. `high`. A patent
 *   document is one of these on any mirror that serves it (patents.google.com,
 *   patentimages.storage.googleapis.com, freepatentsonline.com, patentsview.org), not only on
 *   uspto.gov — see `classifySourceForConfidence`.
 * - Wikipedia and Wikidata are bridge sources. `claim-corroborate` puts a Wikipedia-only claim at
 *   `low` outright, and 2,049 published claims cited Wikipedia at `high`.
 * - Everything else is `medium`, INCLUDING hosts the classifier cannot place. That is deliberate
 *   and conservative in the honest direction: the unclassified tail here is dominated by state
 *   historical societies, state encyclopedias, NPR and the Smithsonian, and calling those `low`
 *   would understate real evidence far more often than `medium` overstates it. Promoting the
 *   deserving ones to `high` is per-host editorial review, the same dated operator review that
 *   built `REPUTABLE_SECONDARY_HOST_SUFFIXES`, and is not a thing to infer in code.
 */
export function confidenceLevelForSource(url: string | undefined): 'high' | 'medium' | 'low' {
  if (url === undefined || url.trim().length === 0) return 'low';
  if (isWikipediaHost(url)) return 'low';
  return classifySourceForConfidence(url) === 'government_record' ? 'high' : 'medium';
}

/** Maps a source URL to the product constitution's sourceClassifications vocabulary. */
export function classifySourceForConfidence(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (
    GOVERNMENT_TLDS.some((tld) => hostUnderTld(hostname, tld)) ||
    GOVERNMENT_DOMAINS.some((domain) => hostMatches(hostname, domain))
  )
    return 'government_record';
  // A patent specification is the same government grant whichever mirror serves it —
  // `resolveSourceLineage` (packages/domain-core/src/claims/lineage.ts) already collapses
  // uspto.gov and patents.google.com onto one lineage for exactly this reason. This
  // classification follows the same logic: it grades the DOCUMENT, not the host serving it, so
  // a patent read on patents.google.com must not grade lower than the identical text read on
  // uspto.gov. `isPatentDocumentUrl` only matches an individual patent document (a resolvable
  // patent number) — a search page or the mirror's home page falls through to the classification
  // below, same as any other unrecognized page on that host.
  if (isPatentDocumentUrl(url)) return 'government_record';
  if (
    ARCHIVAL_DOMAINS.some((domain) => hostMatches(hostname, domain)) ||
    hostUnderTld(hostname, 'edu')
  ) {
    // University archival collections hold scanned original records; general .edu pages
    // (e.g. an alma mater mentioned in passing) do not carry the same evidentiary weight,
    // but distinguishing that would need page-content classification this function doesn't
    // have — treat .edu as reputable_secondary, the conservative (lower-authority) choice.
    return 'reputable_secondary';
  }
  if (isWikipediaHost(url)) return 'reputable_secondary';
  if (isReputableSecondaryHost(url)) return 'reputable_secondary';
  const labels = hostname.split('.');
  if (NEWS_HOST_HINTS.some((hint) => labels.some((label) => label.includes(hint))))
    return 'news_reportage';
  return 'unknown';
}

export type SourceForConfidence = {
  readonly url: string;
  /** Whether the fetched page text actually contains the subject's name — a cheap
   *  directness/entity-match proxy without full NLP entailment checking. */
  readonly textContainsSubjectName?: boolean;
  /**
   * The underlying work this source reproduces, where the pipeline knows it.
   *
   * Set this for a syndicated story or a reprint. Nothing in three newspaper URLs says they
   * are carrying one wire report, so provenance is the only way that gets collapsed.
   */
  readonly upstreamWorkId?: string | undefined;
  /**
   * Set only when provenance confirms this document was created independently of others from
   * the same authority — two separately authored collections at one archive, not two pages of
   * one report.
   */
  readonly independentCreation?: { readonly documentId: string } | undefined;
};

function scoreDimension(textContainsSubjectName: boolean | undefined): number {
  // Conservative default: 0.6 for "unknown whether the text is really about the subject",
  // 0.85 when we've actually checked and confirmed the subject's name appears.
  return textContainsSubjectName ? 0.85 : 0.6;
}

/**
 * Dimensions this function does not measure.
 *
 * These four carry defaults below, which the score needs and which are not measurements. A
 * document's own date is not stored anywhere in bb_evidence (every timestamp there is a system
 * time), place precision is not read off the evidence, and extraction quality describes a
 * selector this path does not create. Naming them lets the research maturity gates tell an
 * assessed record from one that merely scored — without changing what the published score is.
 *
 * `directness` and `entityMatchQuality` are omitted from this list because they ARE derived
 * from something observed, even if only from whether the subject's name appears in the fetched
 * text. That proxy is weak, and it is a different problem from never having looked.
 */
const UNASSESSED_BY_THIS_PATH: readonly string[] = [
  'temporalProximity',
  'geographicPrecision',
  'extractionQuality',
];

function buildEvidenceLink(
  claimId: string,
  source: SourceForConfidence,
  index: number,
  now: string,
): ClaimEvidenceLink {
  const dimensionScore = scoreDimension(source.textContainsSubjectName);
  // Lineage is the underlying work, not the host serving it. `resolveSourceLineage` collapses
  // a patent read at the Patent Office and at a mirror, collapses an authority's subdomains,
  // and puts every Wikipedia spelling on one bridge key.
  const lineage = resolveSourceLineage({
    url: source.url,
    upstreamWorkId: source.upstreamWorkId,
    independentCreation: source.independentCreation,
  });
  return {
    id: `${claimId}-evidence-${index}`,
    claimId,
    claimVersionId: `${claimId}-v1`,
    evidenceId: source.url,
    role: 'supporting',
    lineageRootId: lineage.key,
    bridgeSource: lineage.bridge,
    credible: true,
    sourceClassification: classifySourceForConfidence(source.url),
    directness: dimensionScore,
    temporalProximity: 0.7,
    geographicPrecision: 0.7,
    entityMatchQuality: dimensionScore,
    extractionQuality: 0.8,
    unassessedDimensions: UNASSESSED_BY_THIS_PATH,
    createdAt: now,
  };
}

/**
 * Computes real multi-source confidence for one claim from every source
 * available for its subject (its own citation plus any independently-found
 * corroborating source). `standardPublish`/`highImpactPublish` thresholds and
 * component weights come from the product constitution, not this file.
 */
export function computeClaimConfidence(
  claimId: string,
  sources: readonly SourceForConfidence[],
  options: { readonly claimClass?: 'standard' | 'high_impact'; readonly now?: string } = {},
): ConfidenceEngineResult {
  const now = options.now ?? new Date().toISOString();
  const evidenceLinks = sources.map((source, index) =>
    buildEvidenceLink(claimId, source, index, now),
  );
  return calculateClaimConfidence({
    claimClass: options.claimClass ?? 'standard',
    evidenceLinks,
    calculatedAt: now,
  });
}

export { isTier1Host };
