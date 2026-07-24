/**
 * Story-shaped section index (`/learn/history`, `/learn/topics`, `/learn/myths`):
 * Ledger Line canvas masthead + mono section label + compact story rows.
 * Stack-pushed under the learn navigator — native header owns the top inset.
 */
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  LedgerSectionLabel,
  ScreenCanvas,
  ScreenHeader,
  screenScrollInsets,
} from '@/ui';
import type { LearnMoreSectionRow } from './sections';
import { StoryCompactRow } from './StoryCompactRow';
import { listCatalogEntries } from './content-catalog';
import { storyHref } from './story-index';

export interface StorySectionIndexScreenProps {
  readonly section: LearnMoreSectionRow;
}

export function StorySectionIndexScreen({ section }: StorySectionIndexScreenProps) {
  const entries = listCatalogEntries(section.catalogSection);
  const countLabel = entries.length === 1 ? '1 story' : `${entries.length} stories`;

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: screenScrollInsets.paddingHorizontal,
          paddingTop: screenScrollInsets.paddingTop,
          paddingBottom: screenScrollInsets.paddingBottom,
          gap: screenScrollInsets.gap,
        }}
      >
        <ScreenHeader
          kicker="Archive"
          title={section.title}
          dek={section.subtitle}
          compact
          dense
        />

        <View>
          <LedgerSectionLabel meta={countLabel}>Published stories</LedgerSectionLabel>
          {entries.map((entry, index) => (
            <StoryCompactRow
              key={entry.page.slug}
              entry={entry}
              onPress={() => router.push(storyHref(entry) as never)}
              showDivider={index < entries.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenCanvas>
  );
}
