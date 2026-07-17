/**
 * Per-page publishingPrinciples JSON-LD helper links each trust surface back to the
 * canonical methodology page as its principles document.
 */
import React from 'react';
import { buildPublishingPrinciplesJsonLd } from '../../lib/trust/domain-trust.js';
import { TRUST_PATHS, TRUST_SITE_NAME, resolveTrustUrl } from '../../lib/trust/site-identity.js';

export type PublishingPrinciplesJsonLdScriptProps = {
  readonly pagePath: string;
  readonly pageTitle: string;
  readonly baseUrl?: string;
};

export function PublishingPrinciplesJsonLdScript({
  pagePath,
  pageTitle,
  baseUrl,
}: PublishingPrinciplesJsonLdScriptProps) {
  const jsonLd = buildPublishingPrinciplesJsonLd({
    pageUrl: resolveTrustUrl(pagePath, baseUrl),
    principlesUrl: resolveTrustUrl(TRUST_PATHS.methodology, baseUrl),
    name: `${pageTitle} · ${TRUST_SITE_NAME}`,
  });
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
