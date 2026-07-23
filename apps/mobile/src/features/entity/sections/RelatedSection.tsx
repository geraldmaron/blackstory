/**
 * Connected records (`relatedNeighbors`) and "Also connected" (`continueLearning`) — the
 * bounded 1-hop / capped 2-hop neighbor lists (`normalize.ts` already caps these at
 * `MAX_RELATED_NEIGHBORS`/`MAX_CONTINUE_LEARNING` — 50 each — mirroring
 * `packages/public-contracts/src/v1/entity.ts`'s `boundedArray(relatedNeighborV1Schema, 50)`).
 *
 * NO RECURSION BY CONSTRUCTION: this component renders one FLAT list of neighbor stubs (id,
 * name, kind, summary) — it never fetches or expands a neighbor's OWN related list inline, so
 * a self-referencing or mutually-referencing neighbor entry (the "cyclic related-entity graph"
 * adversarial case) cannot cause unbounded recursive rendering here even though
 * `public-contracts`' `related.ts` schema is already non-recursive by construction. Tapping a
 * neighbor calls `onOpenEntity`, which the screen wires to a NEW navigation (a fresh route
 * push), never an inline expansion of this list.
 */
import { View } from 'react-native';
import { EmptyState, ListRow, LiftedSurface, NavIcon, navIconForEntityKind, Text, space } from '@/ui';
import { RECORD_GAP_COPY, SECTION_HEADINGS } from '../copy';
import { humanizeToken } from '../format';
import type { RelatedNeighbor } from '../types';
import { SectionHeading } from './SectionHeading';

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
    neighbor.summary.trim().length > 0 ? neighbor.summary : `${humanizeToken(neighbor.relationType)} connection to this record.`;
  return (
    <ListRow
      density="compact"
      title={neighbor.displayName}
      subtitle={`${humanizeToken(neighbor.kind)} · ${humanizeToken(neighbor.relationType)} — ${subtitle}`}
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
};

export function RelatedSection({ relatedNeighbors, continueLearning, onOpenEntity }: RelatedSectionProps) {
  return (
    <View style={{ gap: space['4'] }}>
      <View style={{ gap: space['2'] }}>
        <SectionHeading level={2}>{SECTION_HEADINGS.related}</SectionHeading>
        {relatedNeighbors.length === 0 ? (
          <EmptyState title={RECORD_GAP_COPY.related.title} description={RECORD_GAP_COPY.related.body} />
        ) : (
          <LiftedSurface tone="surface" shadow="none">
            {relatedNeighbors.map((neighbor, index) => (
              <NeighborRow
                key={`${neighbor.id}_${neighbor.relationType}_${index}`}
                neighbor={neighbor}
                onPress={onOpenEntity ? () => onOpenEntity(neighbor.id) : undefined}
                showDivider={index < relatedNeighbors.length - 1}
              />
            ))}
          </LiftedSurface>
        )}
      </View>

      {continueLearning.length > 0 ? (
        <View style={{ gap: space['2'] }}>
          <SectionHeading level={3}>{SECTION_HEADINGS.continueLearning}</SectionHeading>
          <Text variant="bodySmall" colorRole="inkMuted">
            Nearby records one step further in the published graph — keep learning without dead ends.
          </Text>
          <LiftedSurface tone="surface" shadow="none">
            {continueLearning.map((neighbor, index) => (
              <NeighborRow
                key={`cl_${neighbor.id}_${neighbor.relationType}_${index}`}
                neighbor={neighbor}
                onPress={onOpenEntity ? () => onOpenEntity(neighbor.id) : undefined}
                showDivider={index < continueLearning.length - 1}
              />
            ))}
          </LiftedSurface>
        </View>
      ) : null}
    </View>
  );
}
