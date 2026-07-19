/**
 * Learn tab — consolidates web's learning-oriented top-level/overflow nav (History, Stories,
 * Myths, Methodology; see `packages/config/src/shell-nav.ts`) into one mobile tab. Each row is a
 * stub pending its own bead (MOB-015 "Learn and supporting public content surfaces"); this
 * screen's job (MOB-008) is only the tab's presence in the route tree and its position in the
 * IA. Rows are non-interactive placeholders, not dead links, until MOB-015 lands real routes.
 */
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, Text } from '@/ui';

const LEARN_SECTIONS = [
  { title: 'History', subtitle: 'Decade-by-decade context (web: /history)' },
  { title: 'Stories', subtitle: 'Long-form narrative features (web: /stories)' },
  { title: 'Myths', subtitle: 'Common misconceptions, corrected (web: /myths)' },
  { title: 'Methodology', subtitle: 'How records are researched and verified (web: /methodology)' },
] as const;

export default function LearnScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="title" isHeading>
          Learn
        </Text>
        <Text variant="body" colorRole="inkMuted">
          Native learning surfaces land in MOB-015. Placeholder rows below are not yet
          navigable.
        </Text>
        {LEARN_SECTIONS.map((section, index) => (
          <ListRow
            key={section.title}
            title={section.title}
            subtitle={section.subtitle}
            interactive={false}
            showDivider={index < LEARN_SECTIONS.length - 1}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
