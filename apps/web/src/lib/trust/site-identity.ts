/**
 * Site identity constants for trust JSON-LD, feeds, and public brand asset paths.
 *
 * Product display name is BlackStory. Package/CSS/env prefixes are brand-agnostic
 * (@repo / ds / APP) and live in @repo/config/identity — do not put product names there.
 */

import {
  PRODUCT_NAME,
  BRAND_ASSETS,
  GCP_PROJECT_ID_PROD,
  brandLockup,
  brandSymbol,
  brandOpenGraph,
} from '@repo/config/identity';

export const TRUST_SITE_NAME = PRODUCT_NAME;

export {
  PRODUCT_NAME,
  BRAND_ASSETS,
  GCP_PROJECT_ID_PROD,
  brandLockup,
  brandSymbol,
  brandOpenGraph,
};

/** Root-relative paths for trust surfaces; absolute URLs are composed at render time when needed. */
export const TRUST_PATHS = {
  methodology: '/methodology',
  errata: '/errata',
  errataFeedJson: '/errata/feed.json',
  errataFeedRss: '/errata/feed.xml',
  corrections: '/corrections',
} as const;

export function resolveTrustUrl(path: string, baseUrl?: string): string {
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}${path}`;
  }
  return path;
}

export function buildNewsMediaOrganizationInput(baseUrl?: string) {
  return {
    name: TRUST_SITE_NAME,
    url: resolveTrustUrl('/', baseUrl),
    correctionsPolicyUrl: resolveTrustUrl(`${TRUST_PATHS.errata}#policy`, baseUrl),
    verificationFactCheckingPolicyUrl: resolveTrustUrl(
      `${TRUST_PATHS.methodology}#verification`,
      baseUrl,
    ),
    ethicsPolicyUrl: resolveTrustUrl(`${TRUST_PATHS.methodology}#independence`, baseUrl),
    ownershipFundingInfoUrl: resolveTrustUrl(`${TRUST_PATHS.methodology}#funding`, baseUrl),
    mastheadUrl: resolveTrustUrl(`${TRUST_PATHS.methodology}#masthead`, baseUrl),
    actionableFeedbackPolicyUrl: resolveTrustUrl(TRUST_PATHS.corrections, baseUrl),
    errataFeedUrl: resolveTrustUrl(TRUST_PATHS.errataFeedJson, baseUrl),
  };
}
