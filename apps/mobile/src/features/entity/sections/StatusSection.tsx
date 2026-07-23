/**
 * Status / event-window section — mirrors web's `EntityStatusPanel` behavior exactly: `event`
 * kind entities have no status of their own and render their `eventWindow` instead (with the
 * same explanatory note); every other kind renders current status + the full `statusHistory`,
 * or the shared `statusHistory` gap notice when neither is present.
 */
import { View } from 'react-native';
import { EmptyState, Text, space } from '@/ui';
import { EVENT_WINDOW_NOTE, RECORD_GAP_COPY, SECTION_HEADINGS } from '../copy';
import { datePrecisionCaption, humanizeToken } from '../format';
import type { Entity } from '../types';
import { SectionHeading } from './SectionHeading';

function formatEventWindowLabel(startAt: string | undefined, endAt: string | null | undefined): string {
  if (!startAt) return 'Undated';
  if (!endAt) return startAt;
  return `${startAt} – ${endAt}`;
}

export type StatusSectionProps = {
  readonly entity: Entity;
};

export function StatusSection({ entity }: StatusSectionProps) {
  if (entity.kind === 'event') {
    const window = entity.eventWindow;
    return (
      <View style={{ gap: space['2'] }}>
        <SectionHeading level={2}>{SECTION_HEADINGS.statusEvent}</SectionHeading>
        <Text variant="body">
          {formatEventWindowLabel(window?.startAt, window?.endAt)}
          {window?.eventType ? ` · ${humanizeToken(window.eventType)}` : ''}
        </Text>
        {window ? (
          <Text variant="caption" colorRole="inkMuted">
            {datePrecisionCaption(window.datePrecision)}
          </Text>
        ) : null}
        <Text variant="bodySmall" colorRole="inkMuted">
          {EVENT_WINDOW_NOTE}
        </Text>
      </View>
    );
  }

  const hasStatus = Boolean(entity.status) && (entity.statusHistory?.length ?? 0) > 0;

  return (
    <View style={{ gap: space['2'] }}>
      <SectionHeading level={2}>{SECTION_HEADINGS.statusRecord}</SectionHeading>
      {!hasStatus ? (
        <EmptyState title={RECORD_GAP_COPY.statusHistory.title} description={RECORD_GAP_COPY.statusHistory.body} />
      ) : (
        <View style={{ gap: space['2'] }}>
          <Text variant="bodyEmphasis">Current status: {humanizeToken(entity.status ?? '')}</Text>
          {(entity.statusHistory ?? []).map((record, index) => (
            <Text key={`${entity.id}_status_${index}`} variant="bodySmall" colorRole="inkMuted">
              {humanizeToken(record.status)} · {record.validFrom ?? 'undated'}
              {record.validTo ? ` through ${record.validTo}` : ', ongoing'} ({datePrecisionCaption(record.datePrecision)})
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
