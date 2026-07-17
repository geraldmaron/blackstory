/**
 * schema.org trust markup builders for site-level NewsMediaOrganization, per-page
 * publishingPrinciples, and ClaimReview (myths surface ONLY). Canonical fact pages must never
 * emit ClaimReview; see `../facts/jsonld.ts` and `assertClaimReviewPathExclusive`.
 */
import type { ErrataChangeType } from './errata-taxonomy.js';

export type TrustSiteIdentity = {
  readonly name: string;
  readonly url: string;
  readonly logoUrl?: string;
};

export type NewsMediaOrganizationJsonLdInput = TrustSiteIdentity & {
  readonly correctionsPolicyUrl: string;
  readonly verificationFactCheckingPolicyUrl: string;
  readonly ethicsPolicyUrl: string;
  readonly ownershipFundingInfoUrl: string;
  readonly mastheadUrl: string;
  readonly actionableFeedbackPolicyUrl: string;
  readonly errataFeedUrl?: string;
};

export type PublishingPrinciplesJsonLdInput = {
  readonly pageUrl: string;
  readonly principlesUrl: string;
  readonly name: string;
};

export type MythClaimReviewInput = {
  readonly pageUrl: string;
  readonly datePublished: string;
  readonly claimReviewed: string;
  readonly reviewBody: string;
  /** Distinct external origin of the circulating claim (Google ClaimReview eligibility). */
  readonly claimOrigin: {
    readonly name: string;
    readonly url?: string;
  };
  readonly ratingExplanation: string;
  readonly authorName: string;
};

/** Paths where ClaimReview JSON-LD is permitted the myths surface only. */
export const CLAIM_REVIEW_ALLOWED_PATH_PREFIX = '/myths/';

export function assertClaimReviewPathExclusive(pagePath: string): void {
  if (!pagePath.startsWith(CLAIM_REVIEW_ALLOWED_PATH_PREFIX) || pagePath === '/myths/') {
    throw new Error(
      `ClaimReview JSON-LD may only be emitted under ${CLAIM_REVIEW_ALLOWED_PATH_PREFIX}<slug> (got "${pagePath}")`,
    );
  }
}

export function buildNewsMediaOrganizationJsonLd(
  input: NewsMediaOrganizationJsonLdInput,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: input.name,
    url: input.url,
    ...(input.logoUrl ? { logo: input.logoUrl } : {}),
    correctionsPolicy: input.correctionsPolicyUrl,
    verificationFactCheckingPolicy: input.verificationFactCheckingPolicyUrl,
    ethicsPolicy: input.ethicsPolicyUrl,
    ownershipFundingInfo: input.ownershipFundingInfoUrl,
    masthead: input.mastheadUrl,
    actionableFeedbackPolicy: input.actionableFeedbackPolicyUrl,
    ...(input.errataFeedUrl ? { subjectOf: { '@type': 'DataFeed', url: input.errataFeedUrl } } : {}),
  };
}

export function buildPublishingPrinciplesJsonLd(
  input: PublishingPrinciplesJsonLdInput,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': input.pageUrl,
    url: input.pageUrl,
    name: input.name,
    publishingPrinciples: input.principlesUrl,
  };
}

export function buildMythClaimReviewJsonLd(
  input: MythClaimReviewInput,
  pagePath: string,
): Record<string, unknown> {
  assertClaimReviewPathExclusive(pagePath);
  return {
    '@context': 'https://schema.org',
    '@type': 'ClaimReview',
    url: input.pageUrl,
    datePublished: input.datePublished,
    claimReviewed: input.claimReviewed,
    reviewBody: input.reviewBody,
    author: {
      '@type': 'Organization',
      name: input.authorName,
    },
    claimReviewedBy: {
      '@type': 'Organization',
      name: input.authorName,
    },
    itemReviewed: {
      '@type': 'Claim',
      author: {
        '@type': 'Organization',
        name: input.claimOrigin.name,
        ...(input.claimOrigin.url ? { url: input.claimOrigin.url } : {}),
      },
      appearance: input.claimOrigin.url ?? input.pageUrl,
    },
    reviewRating: {
      '@type': 'Rating',
      alternateName: input.ratingExplanation,
      ratingExplanation: input.ratingExplanation,
    },
  };
}

/** schema.org CorrectionComment for corrected facts surfaced in the errata log. */
export function buildErrataCorrectionJsonLd(input: {
  readonly pageUrl: string;
  readonly text: string;
  readonly dateModified: string;
  readonly changeType: ErrataChangeType;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CorrectionComment',
    url: input.pageUrl,
    text: input.text,
    dateModified: input.dateModified,
    about: {
      '@type': 'CreativeWork',
      name: input.changeType,
    },
  };
}
