/**
 * More tab index (MOB-015 — fills in the MOB-008 stub for the content rows; "Corrections" was
 * already wired by MOB-008/MOB-016 and is left untouched). About, Quick facts, Legal, Privacy,
 * and Errata now navigate into `/learn/[section]` (this bead's ownership covers Learn AND More
 * content paths — see `src/features/learn/sections.ts`). "Data" (web: `/data`, national rollups
 * built on cited public statistics) is NOT one of this bead's content areas and stays a
 * non-interactive placeholder pending its own bead.
 */
import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Text } from '@/ui';
import { MORE_SECTIONS } from '@/features/learn';

const OUT_OF_SCOPE_SECTIONS = [{ title: 'Data', subtitle: 'web: /data' }] as const;

export default function MoreScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="title" isHeading>
          More
        </Text>

        <ListRow
          title="Submit a correction"
          subtitle="Opens the correction sheet (web: /submit)"
          onPress={() => router.push('/corrections/submit')}
        />

        {MORE_SECTIONS.map((section) => (
          <ListRow
            key={section.routeId}
            title={section.title}
            subtitle={section.subtitle}
            onPress={() => router.push(`/learn/${section.routeId}` as never)}
          />
        ))}

        {OUT_OF_SCOPE_SECTIONS.map((section, index) => (
          <ListRow
            key={section.title}
            title={section.title}
            subtitle={section.subtitle}
            interactive={false}
            showDivider={index < OUT_OF_SCOPE_SECTIONS.length - 1}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
