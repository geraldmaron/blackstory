/**
 * Rate-limit guard for the `/locate` geocode route. Every call proxies the free U.S. Census Geocoder, so this quota bounds
 * our volume against that vendor (geocoding class, expensive_read).
 */
import {
  createPublicRateLimitGuard,
  type PublicRateLimitGuardOptions,
} from '@/lib/web-security/public-rate-limit-guard';

export type LocateRateLimitGuardOptions = PublicRateLimitGuardOptions;

export function createLocateRateLimitGuard(options: LocateRateLimitGuardOptions = {}) {
  return createPublicRateLimitGuard('geocoding', options);
}
