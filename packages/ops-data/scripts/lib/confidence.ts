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
  type ClaimEvidenceLink,
  type ConfidenceEngineResult,
} from '@repo/domain';
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
};

function scoreDimension(textContainsSubjectName: boolean | undefined): number {
  // Conservative default: 0.6 for "unknown whether the text is really about the subject",
  // 0.85 when we've actually checked and confirmed the subject's name appears.
  return textContainsSubjectName ? 0.85 : 0.6;
}

function buildEvidenceLink(
  claimId: string,
  source: SourceForConfidence,
  index: number,
  now: string,
): ClaimEvidenceLink {
  const dimensionScore = scoreDimension(source.textContainsSubjectName);
  return {
    id: `${claimId}-evidence-${index}`,
    claimId,
    claimVersionId: `${claimId}-v1`,
    evidenceId: source.url,
    role: 'supporting',
    // Different hosts are different lineage roots — the whole point of
    // corroboration is that they're INDEPENDENT, not copies of each other.
    lineageRootId: (() => {
      try {
        return new URL(source.url).hostname;
      } catch {
        return source.url;
      }
    })(),
    credible: true,
    sourceClassification: classifySourceForConfidence(source.url),
    directness: dimensionScore,
    temporalProximity: 0.7,
    geographicPrecision: 0.7,
    entityMatchQuality: dimensionScore,
    extractionQuality: 0.8,
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
