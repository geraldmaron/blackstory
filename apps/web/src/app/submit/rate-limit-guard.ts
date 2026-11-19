/**
 * Rate-limit guard for the public lead form. Leads share the corrections endpoint class, with their own store.
 */
import {
  createPublicRateLimitGuard,
  type PublicRateLimitGuardOptions,
} from '@/lib/web-security/public-rate-limit-guard';

export type SubmitLeadRateLimitGuardOptions = PublicRateLimitGuardOptions;

export function createSubmitLeadRateLimitGuard(options: SubmitLeadRateLimitGuardOptions = {}) {
  return createPublicRateLimitGuard('corrections', options);
}
