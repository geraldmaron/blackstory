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
