/**
 * ClaimReview JSON-LD for the /myths surface ONLY reviews of circulating third-party
 * claims with a distinct external origin per Google eligibility rules.
 */
import React from 'react';
import { buildMythClaimReviewJsonLd, type MythClaimReviewInput } from '../../lib/trust/domain-trust';

export type MythClaimReviewScriptProps = MythClaimReviewInput & {
  readonly pagePath: string;
  readonly baseUrl?: string;
};

export function MythClaimReviewScript({
  pagePath,
  baseUrl,
  ...review
}: MythClaimReviewScriptProps) {
  const pageUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}${pagePath}` : review.pageUrl;
  const jsonLd = buildMythClaimReviewJsonLd({ ...review, pageUrl }, pagePath);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
