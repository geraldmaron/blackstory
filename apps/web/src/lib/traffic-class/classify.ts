/**
 * Coarse public-web traffic class from request or browser signals.
 * The result is a closed enum for Vercel custom events. It never carries a
 * user agent string, IP, path, or other identifier.
 */

import {
  AI_TRAINING_USER_AGENTS,
  AUTOMATED_USER_AGENTS,
  SEARCH_CRAWLER_USER_AGENTS,
  TOOL_USER_AGENTS,
} from './agent-lists';

export const TRAFFIC_CLASSES = [
  'search_crawler',
  'ai_crawler',
  'tool',
  'automated',
  'likely_human',
] as const;

export type TrafficClass = (typeof TRAFFIC_CLASSES)[number];

export const TRAFFIC_EVENT_NAME = 'traffic';

export type TrafficClassSignals = {
  readonly userAgent: string;
  readonly acceptLanguage?: string;
  readonly languages?: readonly string[];
  readonly webdriver?: boolean;
};

export type TrafficEventPayload = {
  readonly class: TrafficClass;
};

function matchesAny(userAgent: string, tokens: readonly string[]): boolean {
  const haystack = userAgent.toLowerCase();
  return tokens.some((token) => haystack.includes(token.toLowerCase()));
}

export function classifyTraffic(signals: TrafficClassSignals): TrafficClass {
  const userAgent = signals.userAgent.trim();
  if (userAgent.length === 0) {
    return 'tool';
  }

  // AI tokens first so Applebot-Extended / Google-Extended win over the search stems.
  if (matchesAny(userAgent, AI_TRAINING_USER_AGENTS)) {
    return 'ai_crawler';
  }
  if (matchesAny(userAgent, SEARCH_CRAWLER_USER_AGENTS)) {
    return 'search_crawler';
  }
  if (matchesAny(userAgent, TOOL_USER_AGENTS)) {
    return 'tool';
  }
  if (signals.webdriver === true || matchesAny(userAgent, AUTOMATED_USER_AGENTS)) {
    return 'automated';
  }
  if (signals.languages && signals.languages.length === 0) {
    return 'automated';
  }
  if (signals.acceptLanguage === '') {
    return 'automated';
  }
  return 'likely_human';
}

export function buildTrafficEventPayload(trafficClass: TrafficClass): TrafficEventPayload {
  return { class: trafficClass };
}

/**
 * Share of navigations that send the `traffic` custom event. Vercel bills every collected event,
 * pageview or custom, at the same rate with nothing included on Pro, so an event on every
 * navigation doubled the analytics bill for a ratio that a sample reports just as well. Read the
 * dashboard's per-class counts as one tenth of the truth; the pageview count stays exact.
 */
export const TRAFFIC_EVENT_SAMPLE_RATE = 0.1;

/** Sample decision for one navigation; `random` is injected so the boundary is testable. */
export function shouldSendTrafficEvent(random: number = Math.random()): boolean {
  return random < TRAFFIC_EVENT_SAMPLE_RATE;
}

/**
 * Hosts whose events reach Vercel Analytics. The project's `*.vercel.app` aliases serve the same
 * production build outside Cloudflare's bot challenge, so scrapers and our own release checks
 * land there; they are not readers of blackstory.app.
 */
export const COUNTED_HOSTS: readonly string[] = ['blackstory.app', 'www.blackstory.app'];

/**
 * Whether an analytics event is kept (`beforeSend`). Every event needs a counted host; a pageview
 * also needs a likely-human browser. The sampled `traffic` event still reports automated classes,
 * since measuring them is its job.
 */
export function shouldCountAnalyticsEvent(
  event: { readonly type: 'pageview' | 'event'; readonly url: string },
  trafficClass: TrafficClass,
): boolean {
  let host: string;
  try {
    host = new URL(event.url).hostname;
  } catch {
    return false;
  }
  if (!COUNTED_HOSTS.includes(host)) return false;
  return event.type !== 'pageview' || trafficClass === 'likely_human';
}
