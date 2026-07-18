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
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
