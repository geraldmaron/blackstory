/**
 * More tab — everything else from web's nav (`packages/config/src/shell-nav.ts`): About, Data,
 * Quick facts, Legal, Errata, Submit, plus Corrections. "Corrections" is wired to the
 * correction-submission modal sheet (MOB-008 scope: the route + navigation only — the real
 * submission flow and its App Check posture are MOB-016). Everything else is a stub pending its
 * own bead, same as the Learn tab.
 */
import { router } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Text } from '@/ui';

const STATIC_SECTIONS = [
  { title: 'About', subtitle: 'web: /about' },
  { title: 'Data', subtitle: 'web: /data' },
  { title: 'Quick facts', subtitle: 'web: /facts' },
  { title: 'Legal', subtitle: 'web: /legal' },
  { title: 'Errata', subtitle: 'web: /errata' },
] as const;

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

        {STATIC_SECTIONS.map((section, index) => (
          <ListRow
            key={section.title}
            title={section.title}
            subtitle={section.subtitle}
            interactive={false}
            showDivider={index < STATIC_SECTIONS.length - 1}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
