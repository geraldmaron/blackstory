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
  // These tags render without a nonce because their content is data, not executable JavaScript.
  // Passing a nonce would also create a hydration mismatch: React does not send the server nonce
  // to the client, leaving nonce="..." on the server and nonce="" on the client.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
