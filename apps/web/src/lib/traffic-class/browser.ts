/**
 * Browser-only signal reader for traffic classification. Safe to call from a
 * client effect; returns an empty user agent when `navigator` is missing.
 */

import { classifyTraffic, type TrafficClass, type TrafficClassSignals } from './classify';

export function readBrowserTrafficSignals(): TrafficClassSignals {
  if (typeof navigator === 'undefined') {
    return { userAgent: '' };
  }

  return {
    userAgent: navigator.userAgent,
    languages: Array.from(navigator.languages ?? []),
    webdriver: Boolean(navigator.webdriver),
  };
}

export function classifyTrafficFromBrowser(): TrafficClass {
  return classifyTraffic(readBrowserTrafficSignals());
}
