/**
 * Site-wide disclaimer from the registry one framework, no ad-hoc copy.
 */
import React from 'react';
import { getDisclaimer } from '@black-book/domain';
import { DisclaimerBanner } from '../DisclaimerBanner.js';

export function TrustSiteDisclaimer() {
  return <DisclaimerBanner {...getDisclaimer('site_wide')} />;
}
