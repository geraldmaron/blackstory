/**
 * Every legacy `/learn/...` address, normalized to the surface that now owns it.
 *
 * `/learn` was the native narrative route, and its sections were `history`, `topics`, `myths`,
 * `methodology`, `about`, `facts`, `legal`, `privacy` and `errata` — one route family holding
 * both the publication surface and the product's reference pages. Published deep links and
 * restored navigation state still carry those addresses, so they resolve here in one hop.
 *
 * A catch-all rather than a rule per section: the point is that NO `/learn` address is a
 * destination any more, and enumerating them would invite adding a tenth.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';

import { legacyLearnTarget } from '@/features/content';

export default function LegacyLearnRoute() {
  const { legacy } = useLocalSearchParams<{ legacy?: string | string[] }>();
  const segments = Array.isArray(legacy) ? legacy : legacy ? [legacy] : [];
  return <Redirect href={legacyLearnTarget(segments)} />;
}
