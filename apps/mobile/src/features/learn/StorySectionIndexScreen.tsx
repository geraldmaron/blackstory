/**
 * Story-shaped section index (`/learn/history`, `/learn/topics`, `/learn/myths`): v6 Surface
 * edition stack with indexed header and compact ledger rows with fact strips.
 */
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import {
  EditionSurfacePanel,
  EditionSurfaceStack,
  ScreenCanvas,
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
        }}
      >
        <EditionSurfaceStack>
          <EditionSurfacePanel
            index="00"
            kicker="Archive"
            title={section.title}
            dek={section.subtitle}
            compact
          />

          <EditionSurfacePanel
            index="01"
            kicker="Catalog"
            title="Published stories"
            panelMeta={countLabel}
          >
            {entries.map((entry, index) => (
              <StoryCompactRow
                key={entry.page.slug}
                entry={entry}
                indexLabel={String(index + 1).padStart(2, '0')}
                onPress={() => router.push(storyHref(entry) as never)}
                showDivider={index < entries.length - 1}
              />
            ))}
          </EditionSurfacePanel>
        </EditionSurfaceStack>
      </ScrollView>
    </ScreenCanvas>
  );
}
