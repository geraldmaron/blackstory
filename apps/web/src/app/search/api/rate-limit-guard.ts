/**
 * Rate-limit guard for public search (expensive_read).
 */
import { SEARCH_ENDPOINT_CLASS } from '@repo/security';
import {
  createPublicRateLimitGuard,
  type PublicRateLimitGuardOptions,
} from '@/lib/web-security/public-rate-limit-guard';

export type SearchRateLimitGuardOptions = PublicRateLimitGuardOptions;

export function createSearchRateLimitGuard(options: SearchRateLimitGuardOptions = {}) {
  return createPublicRateLimitGuard(SEARCH_ENDPOINT_CLASS, options);
}
