/**
 * Beat 07: chronological timeline — omitted when no dated spans exist (v6 entity edition).
 */
import { View } from 'react-native';
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
        {timeline.map((event) => (
          <View key={event.id} style={{ gap: space['1'] }}>
            <Text variant="caption" colorRole="inkMuted">
              {event.atLabel} · {datePrecisionCaption(event.datePrecision)}
            </Text>
            <Text variant="rowTitle">{event.title}</Text>
            {event.body ? <Text variant="bodySmall">{event.body}</Text> : null}
          </View>
        ))}
      </View>
      <Text variant="caption" colorRole="inkMuted">
        Dated status changes and relationship timespans published for this record.
      </Text>
    </EntityEditionPanel>
  );
}
