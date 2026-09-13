/**
 * Honest "you're viewing a saved copy" banner (`docs/decisions-carryover.md`, "Mobile cache
 * and OTA release": every cached surface is explicitly labeled with when it was last updated;
 * threat-model T7: "never silently presents stale data
 * as current"). Rendered whenever `freshness.source === 'cache'` — i.e. this content did NOT
 * come from a fresh network read this time, regardless of why (offline, transient failure).
 */
import { Notice } from '@/ui';
import { cachedBannerTitle } from '../copy';
import { formatFetchedAt } from '../format';

export type OfflineBannerProps = {
  readonly fetchedAt: number;
};

export function OfflineBanner({ fetchedAt }: OfflineBannerProps) {
  return (
    <Notice
      tone="warning"
      title={cachedBannerTitle()}
      description={`Last updated ${formatFetchedAt(fetchedAt)}. Some details may have changed since.`}
    />
  );
}
