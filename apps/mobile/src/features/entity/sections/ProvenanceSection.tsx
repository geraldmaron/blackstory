/**
 * Beat 09: record maturity and revision provenance.
 */
import { View } from 'react-native';
import { Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { formatIsoDate, humanizeToken } from '../format';
import type { Entity } from '../types';

function tracked(value: string): string {
  return value.trim().length > 0 ? formatIsoDate(value) : 'Not yet tracked';
}

export type ProvenanceSectionProps = {
  readonly entity: Entity;
  readonly index: string;
};

export function ProvenanceSection({ entity, index }: ProvenanceSectionProps) {
  return (
    <EntityEditionPanel
      index={index}
      kicker="Provenance"
      title="Record maturity and revision"
      testID="entity-provenance-section"
    >
      <Text variant="editorial">
        {`Maturity: ${humanizeToken(entity.recordMaturity || 'unknown')}. Research coverage: ${humanizeToken(entity.researchCoverage || 'unknown')}. Maturity labels follow the product constitution vocabulary.`}
      </Text>

      {entity.revision.releaseId ? (
        <Text variant="code" colorRole="inkMuted">
          {entity.revision.releaseId}
        </Text>
      ) : null}

      <View style={{ gap: space['1'] }}>
        <Text variant="bodySmall" colorRole="inkMuted">
          Record last updated: {tracked(entity.revision.recordUpdatedAt)}
        </Text>
        <Text variant="bodySmall" colorRole="inkMuted">
          Release generated: {tracked(entity.revision.generatedAt)}
        </Text>
      </View>
    </EntityEditionPanel>
  );
}
