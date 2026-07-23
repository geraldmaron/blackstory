/**
 * Entity mast: primary image (or full-bleed EntityMark fallback), compact
 * KIND · PLACE · era meta, display name, and summary. Place prefers postal /
 * short jurisdiction so the line stays scannable on a phone.
 */
import { StyleSheet, View } from 'react-native';
import { Image, Text, space, useThemeColors } from '@/ui';
import type { EntityMarkShape } from '@/ui';
import { humanizeToken } from '../format';
import type { Entity, EntityKind } from '../types';
import { SectionHeading } from './SectionHeading';

function shapeForKind(kind: string): EntityMarkShape {
  const known: Partial<Record<EntityKind, EntityMarkShape>> = {
    person: 'book',
    place: 'pin',
    event: 'pin',
    school: 'book',
    organization: 'arch',
    institution: 'arch',
    law: 'book',
    case: 'book',
    publication: 'book',
    artifact: 'pin',
    movement: 'pin',
    other: 'book',
  };
  return known[kind as EntityKind] ?? 'book';
}

/** Compact place for the mast — avoid long county + state strings. */
function compactPlace(entity: Entity): string | undefined {
  const location = entity.locationLabel.trim();
  // Prefer a trailing state / short fragment when jurisdiction is long.
  const jurisdiction = entity.jurisdictionLabel.trim();
  if (jurisdiction.length > 0 && jurisdiction.toLowerCase() !== 'unknown jurisdiction') {
    if (jurisdiction.length <= 28) return jurisdiction;
    const parts = jurisdiction.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1]!;
    return `${jurisdiction.slice(0, 25).trimEnd()}…`;
  }
  if (location.length > 0 && location.toLowerCase() !== 'unknown location') {
    if (location.length <= 28) return location;
    return `${location.slice(0, 25).trimEnd()}…`;
  }
  return undefined;
}

function eraLabel(entity: Entity): string | undefined {
  const first = entity.eraBuckets?.[0]?.trim();
  return first && first.length > 0 ? humanizeToken(first) : undefined;
}

/** Builds compact `KIND · PLACE · era` (each segment omitted when absent). */
export function buildMastMetaLine(entity: Entity): string {
  return [humanizeToken(entity.kind), compactPlace(entity), eraLabel(entity)]
    .filter(Boolean)
    .join(' · ');
}

export type MastMediaProps = {
  readonly entity: Entity;
};

export function MastMedia({ entity }: MastMediaProps) {
  const theme = useThemeColors();
  const shape = shapeForKind(entity.kind);
  const kindLabel = humanizeToken(entity.kind);
  const metaLine = buildMastMetaLine(entity);

  return (
    <View style={styles.container}>
      <Image
        source={entity.primaryImage?.url}
        alt={entity.primaryImage?.alt ?? entity.displayName}
        aspectRatio={16 / 9}
        fallback={{
          entityName: entity.displayName,
          shape,
          kindLabel,
          reason: entity.primaryImage ? 'pending-rights-review' : 'absent',
        }}
      />
      {entity.primaryImage?.credit ? (
        <Text variant="caption" colorRole="inkSubtle">
          {entity.primaryImage.credit}
        </Text>
      ) : null}

      <View
        style={[
          styles.identityBlock,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {metaLine.length > 0 ? (
          <View style={styles.metaRow}>
            <View
              style={[styles.tick, { backgroundColor: theme.accentGraphic }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text variant="code" colorRole="inkMuted" numberOfLines={1} style={styles.meta}>
              {metaLine}
            </Text>
          </View>
        ) : null}
        <SectionHeading level={1}>{entity.displayName}</SectionHeading>
        {entity.summary ? (
          <Text variant="editorial" colorRole="ink" numberOfLines={6}>
            {entity.summary}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space['2'],
  },
  identityBlock: {
    gap: space['2'],
    padding: space['3'],
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  tick: {
    width: 3,
    height: 12,
    borderRadius: 1,
  },
  meta: {
    flex: 1,
    letterSpacing: 0.4,
  },
});
