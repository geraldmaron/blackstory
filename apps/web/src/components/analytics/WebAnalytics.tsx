/**
 * Public-web analytics: Vercel pageviews plus a classified `traffic` event on a sampled share of
 * navigations (`TRAFFIC_EVENT_SAMPLE_RATE`). The event data is `{ class }` only.
 */
'use client';

import { track } from '@vercel/analytics';
import { Analytics } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { classifyTrafficFromBrowser } from '../../lib/traffic-class/browser';
import {
  buildTrafficEventPayload,
  shouldSendTrafficEvent,
  TRAFFIC_EVENT_NAME,
} from '../../lib/traffic-class/classify';

export function WebAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldSendTrafficEvent()) return;
    void track(TRAFFIC_EVENT_NAME, buildTrafficEventPayload(classifyTrafficFromBrowser()));
  }, [pathname]);

  return <Analytics />;
}
