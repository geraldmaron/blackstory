/**
 * Entity mast: primary image (or a dignified `EntityMark` placeholder — never a portrait/avatar
 * system, per `EntityMark`'s own header comment), kind + jurisdiction line, display name, and
 * summary. Mirrors web's `EntityMastMedia`/entity-page mast in spirit (image leads, identity
 * follows) using MOB-007's existing `Image`/`EntityMark`/`Text` primitives — no new visual
 * primitive is introduced.
 */
import { StyleSheet, View } from 'react-native';
import { Image, LiftedSurface, Text, space } from '@/ui';
import type { EntityMarkShape } from '@/ui';
import { humanizeToken } from '../format';
import type { Entity, EntityKind } from '../types';
import { SectionHeading } from './SectionHeading';

function shapeForKind(kind: string): EntityMarkShape {
  const known: Partial<Record<EntityKind, EntityMarkShape>> = {
    place: 'pin',
    event: 'pin',
    school: 'book',
    institution: 'arch',
  };
  return known[kind as EntityKind] ?? 'book';
}

export type MastMediaProps = {
  readonly entity: Entity;
};

export function MastMedia({ entity }: MastMediaProps) {
  const shape = shapeForKind(entity.kind);
  const kindLabel = humanizeToken(entity.kind);
  const metaLine = [kindLabel, entity.jurisdictionLabel].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <Image
        source={entity.primaryImage?.url}
        alt={entity.primaryImage?.alt ?? entity.displayName}
        aspectRatio={16 / 9}
        fallback={{ entityName: entity.displayName, shape, kindLabel, reason: 'absent' }}
      />
      {entity.primaryImage?.credit ? (
        <Text variant="caption" colorRole="inkSubtle">
          {entity.primaryImage.credit}
        </Text>
      ) : null}
      <LiftedSurface gradient="surfaceLift" shadow="md" paddingKey="3" contentStyle={styles.identityBlock}>
        <Text variant="code" colorRole="inkMuted">
          {metaLine}
        </Text>
        <SectionHeading level={1}>{entity.displayName}</SectionHeading>
        {entity.summary ? (
          <Text variant="bodySmall" colorRole="inkMuted">
            {entity.summary}
          </Text>
        ) : null}
      </LiftedSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space['2'],
  },
  identityBlock: {
    gap: space['2'],
  },
});
