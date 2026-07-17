/**
 * Site-wide disclaimer from the BB-095 registry (BB-088 integration) — one framework, no ad-hoc copy.
 */
import React from 'react';
import { getDisclaimer } from '@black-book/domain';
import { DisclaimerBanner } from '../DisclaimerBanner.js';

export function TrustSiteDisclaimer() {
  return <DisclaimerBanner {...getDisclaimer('site_wide')} />;
}
