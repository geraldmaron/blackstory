/**
 * Public-web analytics: Vercel pageviews plus one classified `traffic` event
 * per navigation. The event data is `{ class }` only.
 */
'use client';

import { track } from '@vercel/analytics';
import { Analytics } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { classifyTrafficFromBrowser } from '../../lib/traffic-class/browser';
import { buildTrafficEventPayload, TRAFFIC_EVENT_NAME } from '../../lib/traffic-class/classify';

export function WebAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    void track(TRAFFIC_EVENT_NAME, buildTrafficEventPayload(classifyTrafficFromBrowser()));
  }, [pathname]);

  return <Analytics />;
}
