/**
 * Beat 08: connected records and optional continue-learning nested block.
 *
 * Every link row carries the evidence meter. Before it did, a reader could see how well evidenced
 * the record in front of them was and then follow a link with no idea whether they were stepping
 * onto a corroborated record or a single-source one — the assessment stopped at the edge of the
 * page. The tier is DERIVED here, from inputs the row carries, through the same
 * `confidenceTierFromEvidenceInputs` the record's own beats reach; the wire never hands this row
 * a letter to print (see `../types.ts`'s `EvidenceInputs`).
 */
import { StyleSheet, View } from 'react-native';
import {
  confidenceTierFromEvidenceInputs,
  evidenceMeterLabel,
} from '@repo/public-contracts/evidence';
import { Ionicons } from '@expo/vector-icons';
import {
  ListRow,
  NavIcon,
  navIconForEntityKind,
  RecordMeter,
  Text,
  space,
  useThemeColors,
} from '@/ui';
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
  const theme = useThemeColors();
  // No inputs means the server could not read this neighbor's claims. That is "unknown", not
  // "unrated", so the row shows no meter at all rather than an assessment nobody made.
  const tier =
    neighbor.evidenceInputs !== undefined
      ? confidenceTierFromEvidenceInputs(neighbor.evidenceInputs)
      : undefined;
  // Kind · relation only — the full summary is often a paragraph, which blows out the row on one
  // unbounded line. The record it links to carries the summary.
  const subtitle = `${humanizeToken(neighbor.kind)} · ${humanizeToken(neighbor.relationType)}`;

  return (
    <ListRow
      density="compact"
      title={neighbor.displayName}
      subtitle={subtitle}
      leading={<NavIcon name={navIconForEntityKind(neighbor.kind)} size={20} />}
      // The row speaks as one element, so the meter is decorative and its sentence rides in this
      // label — nesting a second accessible node there would drop the sentence, not add it.
      accessibilityLabel={
        tier
          ? `${neighbor.displayName}, ${subtitle}. Evidence: ${evidenceMeterLabel(tier)}.`
          : `${neighbor.displayName}, ${subtitle}`
      }
      // Passing `trailing` replaces ListRow's own chevron, so the row draws both: the meter
      // sits beside the affordance rather than instead of it.
      trailing={
        tier ? (
          <View style={styles.trailing}>
            {/* The letter rides beside the bars — color is never the only cue at this density. */}
            <RecordMeter tier={tier} decorative testID={`entity-related-meter-${neighbor.id}`} />
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.inkMuted}
              accessibilityElementsHidden
            />
          </View>
        ) : undefined
      }
      showChevron
      onPress={onPress}
      showDivider={showDivider}
    />
  );
}

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space['2'],
  },
});

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
        <View>
          {relatedNeighbors.map((neighbor, neighborIndex) => (
            <NeighborRow
              key={`${neighbor.id}_${neighbor.relationType}_${neighborIndex}`}
              neighbor={neighbor}
              onPress={onOpenEntity ? () => onOpenEntity(neighbor.id) : undefined}
              showDivider={neighborIndex < relatedNeighbors.length - 1}
            />
          ))}
        </View>
      )}

      {continueLearning.length > 0 ? (
        <View style={{ gap: space['2'] }}>
          <SectionHeading level={3}>{SECTION_HEADINGS.continueLearning}</SectionHeading>
          <Text variant="bodySmall" colorRole="inkMuted">
            Nearby records one step further in the published graph. Keep learning without dead ends.
          </Text>
          <View>
            {continueLearning.map((neighbor, neighborIndex) => (
              <NeighborRow
                key={`cl_${neighbor.id}_${neighbor.relationType}_${neighborIndex}`}
                neighbor={neighbor}
                onPress={onOpenEntity ? () => onOpenEntity(neighbor.id) : undefined}
                showDivider={neighborIndex < continueLearning.length - 1}
              />
            ))}
          </View>
        </View>
      ) : null}
    </EntityEditionPanel>
  );
}
