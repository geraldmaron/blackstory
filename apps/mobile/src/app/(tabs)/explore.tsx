/**
 * Explore tab — canonical mobile counterpart of web's `/explore`. The native map/list
 * experience itself is MOB-011/MOB-012 scope; this screen (MOB-008) wires the route surface:
 * typed + validated filter query params, and stack-push navigation into `entity/[id]` (the
 * shared detail route reachable from every tab).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseFilterState } from '../_lib/route-params';
import { Button, Divider, ListRow, Notice, Text } from '@/ui';

// Stub catalog entries for wiring the entity route only — MOB-009 (typed API client) replaces
// this with a real fetch through apps/api-public. IDs match the real fixture shape (see
// packages/firebase/fixtures/national-catalog/*.json) so entity-route validation is exercised
// against realistic values, not placeholders.
const STUB_ENTITIES = [
  { id: 'ent_caam_los_angeles_001', title: 'California African American Museum', subtitle: 'Los Angeles, CA' },
  { id: 'ent_moad_san_francisco_001', title: 'Museum of the African Diaspora', subtitle: 'San Francisco, CA' },
  { id: 'ent_harvey_gantt_center_001', title: 'Harvey B. Gantt Center', subtitle: 'Charlotte, NC' },
] as const;

export default function ExploreScreen() {
  const rawParams = useLocalSearchParams();
  const filters = parseFilterState(rawParams as Record<string, unknown>);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="title" isHeading>
          Explore
        </Text>
        <Text variant="body" colorRole="inkMuted">
          Map and list surface (native map lands in MOB-012). Filter state below is parsed and
          validated from the route&apos;s query params — never used raw.
        </Text>

        {(filters.kind || filters.era) ? (
          <Notice
            tone="info"
            title="Active filters"
            description={[filters.kind && `Kind: ${filters.kind}`, filters.era && `Era: ${filters.era}`]
              .filter(Boolean)
              .join(' · ')}
          />
        ) : null}

        <Button label="Filters" variant="secondary" onPress={() => router.push('/filters-sheet')} />

        <Divider />

        <View>
          {STUB_ENTITIES.map((entity, index) => (
            <ListRow
              key={entity.id}
              title={entity.title}
              subtitle={entity.subtitle}
              showDivider={index < STUB_ENTITIES.length - 1}
              onPress={() => router.push({ pathname: '/entity/[id]', params: { id: entity.id } })}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
