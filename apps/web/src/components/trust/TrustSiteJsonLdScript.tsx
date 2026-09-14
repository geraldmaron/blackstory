/**
 * Site-wide NewsMediaOrganization JSON-LD script Trust Project schema vocabulary
 * without trademark or badge usage.
 */
import React from 'react';
import { buildNewsMediaOrganizationJsonLd } from '../../lib/trust/domain-trust';
import { buildNewsMediaOrganizationInput } from '../../lib/trust/site-identity';

export type TrustSiteJsonLdScriptProps = {
  readonly baseUrl?: string;
};

export function TrustSiteJsonLdScript({ baseUrl }: TrustSiteJsonLdScriptProps) {
  const jsonLd = buildNewsMediaOrganizationJsonLd(buildNewsMediaOrganizationInput(baseUrl));
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
