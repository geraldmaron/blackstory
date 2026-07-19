/**
 * Entity detail — canonical mobile counterpart of web's `/entity/[id]` (`apps/web/src/app/entity/[id]`),
 * reachable as a stack push from Explore, Search, Learn, or More. This is also the universal-link
 * target for `https://blackbook.app/entity/{id}` (see app.config.ts's `associatedDomains`/
 * `intentFilters`); an app-not-installed open of that same URL falls through to the web route,
 * which is the correct, inherent Universal Links / App Links behavior (no mobile-side code
 * needed for that fallback — see apps/mobile/public/.well-known/README.md).
 *
 * Real entity data (evidence, timeline, media) is MOB-014 scope. This screen (MOB-008) owns only
 * the route itself: the `id` path param is validated through the shared parser before anything
 * else happens. An invalid, oversized, or unsafe id (see threat-model T4 and
 * `_lib/route-params.test.ts`'s fuzz corpus) never reaches a fetch/render — the screen redirects
 * to the safe default (Explore) instead of crashing or attempting to interpret the raw string.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseEntityId } from '../_lib/route-params';
import { Notice, Text } from '@/ui';

export default function EntityDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const entityId = parseEntityId(id);

  if (!entityId) {
    // Unknown/malformed/unsafe id — safe-default fallback, never a raw render of the input.
    return <Redirect href="/explore" />;
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="title" isHeading>
          Record
        </Text>
        <Notice
          tone="info"
          title="Validated route parameter"
          description={`id = ${entityId}`}
        />
        <Text variant="body" colorRole="inkMuted">
          Full evidence, timeline, and media (MOB-014) are not wired yet — this route exists to
          prove navigation, typed params, and deep-link validation (MOB-008).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
