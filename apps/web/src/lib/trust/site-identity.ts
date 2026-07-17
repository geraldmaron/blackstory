/**
 * Site identity constants for trust JSON-LD and feed builders (BB-088).
 */

export const TRUST_SITE_NAME = 'Black Book';

/** Root-relative paths for trust surfaces — absolute URLs are composed at render time when needed. */
export const TRUST_PATHS = {
  methodology: '/methodology',
  errata: '/errata',
  errataFeedJson: '/errata/feed.json',
  errataFeedRss: '/errata/feed.xml',
  corrections: '/corrections',
  myths: '/myths',
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
    verificationFactCheckingPolicyUrl: resolveTrustUrl(`${TRUST_PATHS.methodology}#verification`, baseUrl),
    ethicsPolicyUrl: resolveTrustUrl(`${TRUST_PATHS.methodology}#independence`, baseUrl),
    ownershipFundingInfoUrl: resolveTrustUrl(`${TRUST_PATHS.methodology}#funding`, baseUrl),
    mastheadUrl: resolveTrustUrl(`${TRUST_PATHS.methodology}#masthead`, baseUrl),
    actionableFeedbackPolicyUrl: resolveTrustUrl(TRUST_PATHS.corrections, baseUrl),
    errataFeedUrl: resolveTrustUrl(TRUST_PATHS.errataFeedJson, baseUrl),
  };
}
