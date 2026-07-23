/**
 * Story-shaped section index (`/learn/history`, `/learn/topics`, `/learn/myths`): compact ledger
 * list instead of generic ListRows — matches web `/stories` index density.
 */
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import {
  LiftedSurface,
  ScreenCanvas,
  ScreenHeader,
  SectionHeader,
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
    <ScreenCanvas>
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
        />
        <SectionHeader title="Stories" meta={countLabel} headingScale="bodyEmphasis" />
        <LiftedSurface tone="surface" shadow="none">
          {entries.map((entry, index) => (
            <StoryCompactRow
              key={entry.page.slug}
              entry={entry}
              onPress={() => router.push(storyHref(entry) as never)}
              showDivider={index < entries.length - 1}
            />
          ))}
        </LiftedSurface>
      </ScrollView>
    </ScreenCanvas>
  );
}
