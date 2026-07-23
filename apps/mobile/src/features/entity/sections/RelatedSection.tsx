/**
 * Beat 08: connected records and optional continue-learning nested block.
 */
import { View } from 'react-native';
import { ListRow, LiftedSurface, NavIcon, navIconForEntityKind, Text, space } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { RecordGapNotice } from '../RecordGapNotice';
import { SECTION_HEADINGS } from '../copy';
import { humanizeToken } from '../format';
import { SectionHeading } from './SectionHeading';
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
  return (
    <ListRow
      density="compact"
      title={neighbor.displayName}
      // Kind · relation only — the full summary is often a paragraph, which blows out the row on
      // one unbounded line. The record it links to carries the summary.
      subtitle={`${humanizeToken(neighbor.kind)} · ${humanizeToken(neighbor.relationType)}`}
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
          <SectionHeading level={3}>{SECTION_HEADINGS.continueLearning}</SectionHeading>
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
