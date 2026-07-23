/**
 * Beats 02–04: relevance, historical context, and optional further reading.
 */
import { View } from 'react-native';
import { Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { RecordGapNotice } from '../RecordGapNotice';
import { SECTION_HEADINGS } from '../copy';
import { MAX_EXTENDED_NARRATIVE_CHARS } from '../types';
import type { Entity } from '../types';
import type { EntityBeatIndices } from '../entity-beat-indices';

export type NarrativeSectionsProps = {
  readonly entity: Entity;
  readonly beats: Pick<EntityBeatIndices, 'relevance' | 'context' | 'reading'>;
};

export function NarrativeSections({ entity, beats }: NarrativeSectionsProps) {
  const narrative = entity.extendedNarrative;
  const narrativeTruncated =
    narrative !== undefined && narrative.length >= MAX_EXTENDED_NARRATIVE_CHARS;

  return (
    <View style={{ gap: space['5'] }}>
      <EntityEditionPanel
        index={beats.relevance}
        kicker="Relevance"
        title={SECTION_HEADINGS.relevance}
        testID="entity-relevance-section"
      >
        {entity.relevanceExplanation.trim().length > 0 ? (
          <Text variant="editorial">{entity.relevanceExplanation}</Text>
        ) : (
          <RecordGapNotice kind="relevance" />
        )}
      </EntityEditionPanel>

      <EntityEditionPanel
        index={beats.context}
        kicker="Context"
        title={SECTION_HEADINGS.context}
        testID="entity-context-section"
      >
        {entity.historicalContext.trim().length > 0 ? (
          <Text variant="editorial">{entity.historicalContext}</Text>
        ) : (
          <RecordGapNotice kind="context" />
        )}
      </EntityEditionPanel>

      {narrative && beats.reading ? (
        <EntityEditionPanel
          index={beats.reading}
          kicker="Reading"
          title={SECTION_HEADINGS.furtherReading}
          testID="entity-reading-section"
        >
          <Text variant="editorial">{narrative}</Text>
          {narrativeTruncated ? (
            <Text variant="caption" colorRole="inkMuted">
              This passage has been shortened for display.
            </Text>
          ) : null}
        </EntityEditionPanel>
      ) : null}
    </View>
  );
}
