/**
 * Rate-limit guard for correction intake (corrections class: anonymous capacity 2, window cap 2, daily 8).
 */
import {
  createPublicRateLimitGuard,
  type PublicRateLimitGuardOptions,
} from '@/lib/web-security/public-rate-limit-guard';

export type CorrectionRateLimitGuardOptions = PublicRateLimitGuardOptions;

export function createCorrectionRateLimitGuard(options: CorrectionRateLimitGuardOptions = {}) {
  return createPublicRateLimitGuard('corrections', options);
}
