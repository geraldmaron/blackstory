/**
 * Beat 08: connected records and optional continue-learning nested block.
 */
import { View } from 'react-native';
import { ListRow, LiftedSurface, NavIcon, navIconForEntityKind, Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { RecordGapNotice } from '../RecordGapNotice';
import { SECTION_HEADINGS } from '../copy';
import { humanizeToken } from '../format';
import type { RelatedNeighbor } from '../types';

function NeighborRow({
  neighbor,
  onPress,
  showDivider = true,
}: {
  readonly neighbor: RelatedNeighbor;
  readonly onPress?: () => void;
  readonly showDivider?: boolean;
}) {
  const subtitle =
    neighbor.summary.trim().length > 0
      ? neighbor.summary
      : `${humanizeToken(neighbor.relationType)} connection to this record.`;
  return (
    <ListRow
      density="compact"
      title={neighbor.displayName}
      subtitle={`${humanizeToken(neighbor.kind)} · ${humanizeToken(neighbor.relationType)} · ${subtitle}`}
      leading={<NavIcon name={navIconForEntityKind(neighbor.kind)} size={20} />}
      showChevron
      onPress={onPress}
      showDivider={showDivider}
    />
  );
}

export type RelatedSectionProps = {
  readonly relatedNeighbors: readonly RelatedNeighbor[];
  readonly continueLearning: readonly RelatedNeighbor[];
  readonly onOpenEntity?: (entityId: string) => void;
  readonly index: string;
};

export function RelatedSection({
  relatedNeighbors,
  continueLearning,
  onOpenEntity,
  index,
}: RelatedSectionProps) {
  return (
    <EntityEditionPanel
      index={index}
      kicker="Connected"
      title={SECTION_HEADINGS.related}
      testID="entity-connected-section"
    >
      {relatedNeighbors.length === 0 ? (
        <RecordGapNotice kind="related" />
      ) : (
        <LiftedSurface tone="surfaceRaised" shadow="none">
          {relatedNeighbors.map((neighbor, neighborIndex) => (
            <NeighborRow
              key={`${neighbor.id}_${neighbor.relationType}_${neighborIndex}`}
              neighbor={neighbor}
              onPress={onOpenEntity ? () => onOpenEntity(neighbor.id) : undefined}
              showDivider={neighborIndex < relatedNeighbors.length - 1}
            />
          ))}
        </LiftedSurface>
      )}

      {continueLearning.length > 0 ? (
        <View style={{ gap: space['2'] }}>
          <Text variant="bodyEmphasis" isHeading testID="heading-level-3">
            {SECTION_HEADINGS.continueLearning}
          </Text>
          <Text variant="bodySmall" colorRole="inkMuted">
            Nearby records one step further in the published graph. Keep learning without dead ends.
          </Text>
          <LiftedSurface tone="surfaceRaised" shadow="none">
            {continueLearning.map((neighbor, neighborIndex) => (
              <NeighborRow
                key={`cl_${neighbor.id}_${neighbor.relationType}_${neighborIndex}`}
                neighbor={neighbor}
                onPress={onOpenEntity ? () => onOpenEntity(neighbor.id) : undefined}
                showDivider={neighborIndex < continueLearning.length - 1}
              />
            ))}
          </LiftedSurface>
        </View>
      ) : null}
    </EntityEditionPanel>
  );
}
