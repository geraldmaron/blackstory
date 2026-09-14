/**
 * The record side of the archive's thesis: every record links back to the writing about it.
 *
 * Web ships this as `RecordSheet`'s "Cited in" group and the record room's chapter list; the
 * phone had no equivalent, so a reader could open a record from a story's map inset and never
 * learn which story had put it there. The edge is derived server-side by
 * `@repo/domain/publication/cites-edge` and arrives on the entity payload as `citingStories`.
 *
 * EMPTY IS EMPTY — this beat does not render when nothing cites the record, and it deliberately
 * does NOT use `RecordGapNotice`. The other sparse beats use that notice because a record with no
 * claims, no linked records or no dated history has a research gap worth naming honestly. This is
 * not that. Most of the published catalog has no story written about it yet, and that is a fact
 * about how much long-form the archive has published, not about how well researched the record
 * is. Printing "no story cites this record yet" on almost every record would read as an
 * accusation against the record. Web makes the same call at `RecordSheet.tsx`.
 *
 * `relation` is rendered as the words the server sent ("mapped in", "referenced in"). The client
 * never branches on it, so a new relation phrase ships without a client release.
 */
import { View } from 'react-native';
import { ListRow, NavIcon, Text } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { SECTION_HEADINGS } from '../copy';
import type { StoryCitation } from '../types';

export type CitedInSectionProps = {
  readonly citingStories: readonly StoryCitation[];
  readonly onOpenStory?: (slug: string) => void;
  readonly index: string;
};

function storyCountLabel(count: number): string {
  return count === 1 ? '1 story' : `${count} stories`;
}

export function CitedInSection({ citingStories, onOpenStory, index }: CitedInSectionProps) {
  if (citingStories.length === 0) return null;

  return (
    <EntityEditionPanel
      index={index}
      kicker="Cited in"
      title={SECTION_HEADINGS.citedIn}
      testID="entity-cited-in-section"
    >
      <Text variant="bodySmall" colorRole="inkMuted">
        {storyCountLabel(citingStories.length)} in the published edition{' '}
        {citingStories.length === 1 ? 'draws on' : 'draw on'} this record.
      </Text>
      <View>
        {citingStories.map((story, storyIndex) => (
          <ListRow
            density="compact"
            key={story.slug}
            title={story.title}
            subtitle={story.relation}
            leading={<NavIcon name="stories" size={20} />}
            accessibilityLabel={`${story.title}, ${story.relation} this record`}
            showChevron
            {...(onOpenStory ? { onPress: () => onOpenStory(story.slug) } : {})}
            showDivider={storyIndex < citingStories.length - 1}
          />
        ))}
      </View>
    </EntityEditionPanel>
  );
}
