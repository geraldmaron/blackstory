/**
 * Beat 05: status / event-window panel — mirrors web `EntityStatusPanel`.
 */
import { View } from 'react-native';
import { Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { RecordGapNotice } from '../RecordGapNotice';
import { EVENT_WINDOW_NOTE, SECTION_HEADINGS } from '../copy';
import { datePrecisionCaption, humanizeToken } from '../format';
import type { Entity } from '../types';

export type StatusSectionProps = {
  readonly entity: Entity;
  readonly index: string;
};

function formatEventWindowLabel(startAt: string | undefined, endAt: string | null | undefined): string {
  if (!startAt) return 'Undated';
  if (!endAt) return startAt;
  return `${startAt} to ${endAt}`;
}

export function StatusSection({ entity, index }: StatusSectionProps) {
  const statusHeading =
    entity.kind === 'event' ? SECTION_HEADINGS.statusEvent : SECTION_HEADINGS.statusRecord;

  return (
    <EntityEditionPanel
      index={index}
      kicker="Status"
      title={statusHeading}
      testID="entity-status-section"
    >
      {entity.kind === 'event' ? (
        <View style={{ gap: space['2'] }}>
          {entity.eventWindow ? (
            <>
              <Text variant="body">
                {formatEventWindowLabel(entity.eventWindow.startAt, entity.eventWindow.endAt)}
                {entity.eventWindow.eventType ? ` · ${humanizeToken(entity.eventWindow.eventType)}` : ''}
              </Text>
              <Text variant="caption" colorRole="inkMuted">
                {datePrecisionCaption(entity.eventWindow.datePrecision)}
              </Text>
            </>
          ) : (
            <RecordGapNotice kind="statusHistory" />
          )}
          <Text variant="bodySmall" colorRole="inkMuted">
            {EVENT_WINDOW_NOTE}
          </Text>
        </View>
      ) : (entity.statusHistory?.length ?? 0) > 0 ? (
        <View style={{ gap: space['2'] }}>
          <Text variant="bodyEmphasis">Current status: {humanizeToken(entity.status ?? '')}</Text>
          {(entity.statusHistory ?? []).map((record, recordIndex) => (
            <Text
              key={`${entity.id}_status_${recordIndex}`}
              variant="bodySmall"
              colorRole="inkMuted"
            >
              {humanizeToken(record.status)} · {record.validFrom ?? 'undated'}
              {record.validTo ? ` through ${record.validTo}` : ', ongoing'} (
              {datePrecisionCaption(record.datePrecision)})
            </Text>
          ))}
        </View>
      ) : (
        <RecordGapNotice kind="statusHistory" />
      )}
    </EntityEditionPanel>
  );
}
