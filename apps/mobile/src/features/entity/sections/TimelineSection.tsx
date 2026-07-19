/**
 * Chronological claim/revision timeline. Each entry shows the server-provided `atLabel`
 * VERBATIM as the primary date text (never reformatted/reparsed from `at`, which would risk
 * implying more precision than `datePrecision` states) plus an explicit precision caption —
 * the concrete mechanism behind "never fabricate precision beyond what the data states."
 */
import { View } from 'react-native';
import { EmptyState, Text, space } from '@/ui';
import { RECORD_GAP_COPY, SECTION_HEADINGS } from '../copy';
import { datePrecisionCaption } from '../format';
import type { TimelineEvent } from '../types';
import { SectionHeading } from './SectionHeading';

export type TimelineSectionProps = {
  readonly timeline: readonly TimelineEvent[];
};

export function TimelineSection({ timeline }: TimelineSectionProps) {
  return (
    <View style={{ gap: space['3'] }}>
      <SectionHeading level={2}>{SECTION_HEADINGS.timeline}</SectionHeading>
      {timeline.length === 0 ? (
        <EmptyState title={RECORD_GAP_COPY.timeline.title} description={RECORD_GAP_COPY.timeline.body} />
      ) : (
        timeline.map((event) => (
          <View key={event.id} style={{ gap: space['1'] }}>
            <Text variant="caption" colorRole="inkMuted">
              {event.atLabel} · {datePrecisionCaption(event.datePrecision)}
            </Text>
            <Text variant="bodyEmphasis">{event.title}</Text>
            {event.body ? <Text variant="bodySmall">{event.body}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}
