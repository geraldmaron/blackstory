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
import { calculateClaimConfidence, type ClaimEvidenceLink, type ConfidenceEngineResult } from '@repo/domain';
import { isTier1Host } from './tier1-sources.ts';

const GOVERNMENT_HOST_PATTERNS = [/\.gov$/iu, /\.mil$/iu, /(^|\.)si\.edu$/iu];
const NEWS_HOST_HINTS = ['news', 'times', 'post', 'tribune', 'gazette', 'herald'];

/** Maps a source URL to the product constitution's sourceClassifications vocabulary. */
export function classifySourceForConfidence(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }
  if (GOVERNMENT_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) return 'government_record';
  if (/(^|\.)(rosenwald\.fisk|archive)\./u.test(hostname) || hostname.endsWith('.edu')) {
    // University archival collections hold scanned original records; general .edu pages
    // (e.g. an alma mater mentioned in passing) do not carry the same evidentiary weight,
    // but distinguishing that would need page-content classification this function doesn't
    // have — treat .edu as reputable_secondary, the conservative (lower-authority) choice.
    return 'reputable_secondary';
  }
  if (hostname.includes('wikipedia.org') || hostname.includes('wikidata.org')) return 'reputable_secondary';
  if (NEWS_HOST_HINTS.some((hint) => hostname.includes(hint))) return 'news_reportage';
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
  const evidenceLinks = sources.map((source, index) => buildEvidenceLink(claimId, source, index, now));
  return calculateClaimConfidence({
    claimClass: options.claimClass ?? 'standard',
    evidenceLinks,
    calculatedAt: now,
  });
}

export { isTier1Host };
