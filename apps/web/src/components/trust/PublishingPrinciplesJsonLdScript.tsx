/**
 * Per-page publishingPrinciples JSON-LD helper links each trust surface back to the
 * canonical methodology page as its principles document.
 */
import React from 'react';
import { buildPublishingPrinciplesJsonLd } from '../../lib/trust/domain-trust';
import { TRUST_PATHS, TRUST_SITE_NAME, resolveTrustUrl } from '../../lib/trust/site-identity';

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
  // No nonce on JSON-LD: CSP script-src governs script EXECUTION, and a <script> with a
  // non-JavaScript type is never executed, so it is not a script block the policy applies to.
  // Verified in a real browser against the nonce-gated CSP (repo-77nk): these tags render with
  // no nonce, full content, and zero CSP violations. Passing one here also broke hydration —
  // React does not send the nonce to the client, so the server rendered nonce="..." against a
  // client nonce="" and reported a mismatch it "won't patch up" on every trust surface.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
