/**
 * Public-web analytics: Vercel pageviews plus a classified `traffic` event on a sampled share of
 * navigations (`TRAFFIC_EVENT_SAMPLE_RATE`). The event data is `{ class }` only. `beforeSend` keeps
 * only blackstory.app, and only likely-human pageviews (`shouldCountAnalyticsEvent`).
 */
'use client';

import { track } from '@vercel/analytics';
import { Analytics, type BeforeSend } from '@vercel/analytics/next';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { classifyTrafficFromBrowser } from '../../lib/traffic-class/browser';
import {
  buildTrafficEventPayload,
  shouldCountAnalyticsEvent,
  shouldSendTrafficEvent,
  TRAFFIC_EVENT_NAME,
} from '../../lib/traffic-class/classify';

const beforeSend: BeforeSend = (event) =>
  shouldCountAnalyticsEvent(event, classifyTrafficFromBrowser()) ? event : null;

export function WebAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!shouldSendTrafficEvent()) return;
    void track(TRAFFIC_EVENT_NAME, buildTrafficEventPayload(classifyTrafficFromBrowser()));
  }, [pathname]);

  return <Analytics beforeSend={beforeSend} />;
}
