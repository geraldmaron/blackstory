/**
 * Entity mast: primary image (or a dignified `EntityMark` placeholder — never a portrait/avatar
 * system, per `EntityMark`'s own header comment), kind + jurisdiction line, display name, and
 * summary. Mirrors web's `EntityMastMedia`/entity-page mast in spirit (image leads, identity
 * follows) using MOB-007's existing `Image`/`EntityMark`/`Text` primitives — no new visual
 * primitive is introduced.
 */
import { View } from 'react-native';
import { Image, Text, space } from '@/ui';
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

  return (
    <View style={{ gap: space['2'] }}>
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
      <Text variant="caption" colorRole="inkMuted">
        {kindLabel}
        {entity.jurisdictionLabel ? ` · ${entity.jurisdictionLabel}` : ''}
      </Text>
      <SectionHeading level={1}>{entity.displayName}</SectionHeading>
      {entity.summary ? <Text variant="body">{entity.summary}</Text> : null}
    </View>
  );
}
