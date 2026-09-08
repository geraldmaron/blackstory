/**
 * Chronology: the record's dated spans, omitted when it has none.
 *
 * Bodies run through `stripInternalIds` before they render. The generator appends the claim ids a
 * dated statement rests on — "In effect from 1840, ongoing as of this release. Basis:
 * plantation_…_claim_0, plantation_…_claim_1, …" — which arrived on the record page as four lines
 * of database key in the middle of the reader's chronology.
 */
import { View } from 'react-native';
import { containsInternalId, stripInternalIds } from '@repo/public-contracts/narrative-text';
import { Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { SECTION_HEADINGS } from '../copy';
import { datePrecisionCaption } from '../format';
import type { TimelineEvent } from '../types';

export type TimelineSectionProps = {
  readonly timeline: readonly TimelineEvent[];
  readonly index: string;
};

export function TimelineSection({ timeline, index }: TimelineSectionProps) {
  if (timeline.length === 0) {
    return null;
  }

  return (
    <EntityEditionPanel
      index={index}
      kicker="Chronology"
      title={SECTION_HEADINGS.timeline}
      testID="entity-timeline-section"
    >
      <View style={{ gap: space['3'] }}>
        {timeline.map((event) => {
          const body = event.body ? stripInternalIds(event.body) : '';
          // A body that is nothing but ids leaves nothing to say; the dated heading still stands.
          const showBody = body.length > 0 && !containsInternalId(body);
          return (
            <View key={event.id} style={{ gap: space['1'] }}>
              <Text variant="caption" colorRole="inkMuted">
                {event.atLabel} · {datePrecisionCaption(event.datePrecision)}
              </Text>
              <Text variant="rowTitle">{event.title}</Text>
              {showBody ? <Text variant="bodySmall">{body}</Text> : null}
            </View>
          );
        })}
      </View>
      <Text variant="caption" colorRole="inkMuted">
        Dated status changes and relationship timespans published for this record.
      </Text>
    </EntityEditionPanel>
  );
}
