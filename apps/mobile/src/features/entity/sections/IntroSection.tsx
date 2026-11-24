import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ExhibitFrame, Image, Receipt, Text, space, useThemeColors } from '@/ui';
import type { EntityMarkShape } from '@/ui';
import { SectionHeading } from './SectionHeading';
import { humanizeToken } from '../format';
import type { Entity, EntityKind } from '../types';
import {
  deriveHistoricalFraming,
  historicalFramingLabel,
  isQuietRecord,
} from '../entity-view-model';

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

function isDisplayableJurisdictionLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length === 0) return false;
  if (/^unknown(\s+jurisdiction)?$/iu.test(trimmed)) return false;
  return !/^(united states of america|united states|u\.s\.a\.|u\.s\.|usa)$/iu.test(trimmed);
}

/** Builds intro meta row: kind · jurisdiction · framing label. */
export function buildIntroMetaLine(entity: Entity): string {
  const parts: string[] = [humanizeToken(entity.kind)];
  if (isDisplayableJurisdictionLabel(entity.jurisdictionLabel)) {
    parts.push(entity.jurisdictionLabel.trim());
  }
  parts.push(historicalFramingLabel(deriveHistoricalFraming(entity)));
  return parts.join(' · ');
}

export type IntroSectionProps = {
  readonly entity: Entity;
  /** What leads when the record has no photograph: its map exhibit. */
  readonly lead?: ReactNode;
};

/**
 * The top of a record on a phone: the lead exhibit, then the name, then the summary
 * (docs/ui/DESIGN.md section 9.1). The photograph leads when there is one; otherwise `lead`.
 */
export function IntroSection({ entity, lead }: IntroSectionProps) {
  const theme = useThemeColors();
  const metaLine = buildIntroMetaLine(entity);
  const image = entity.primaryImage;

  return (
    <View style={styles.intro} testID="entity-intro-section">
      {/* The record stores no date for its image, so the label never implies the period. */}
      {image ? (
        <ExhibitFrame
          kind="photograph"
          basis="date not on record"
          variant={isQuietRecord(entity) ? 'quiet' : 'full'}
          receipt={image.credit ? <Receipt source={image.credit} /> : undefined}
          testID="entity-photograph"
        >
          <Image
            source={image.url}
            alt={image.alt ?? entity.displayName}
            aspectRatio={3 / 2}
            fallback={{
              entityName: entity.displayName,
              shape: shapeForKind(entity.kind),
              kindLabel: humanizeToken(entity.kind),
              reason: 'pending-rights-review',
            }}
          />
        </ExhibitFrame>
      ) : (
        lead
      )}

      <View style={styles.name}>
        <Text variant="meta" colorRole="inkMuted" style={styles.label}>
          {metaLine}
        </Text>
        <SectionHeading level={1}>{entity.displayName}</SectionHeading>
      </View>

      {entity.summary.trim().length > 0 ? (
        <Text variant="editorial" colorRole="ink">
          {entity.summary}
        </Text>
      ) : null}

      {entity.topicTags.length > 0 ? (
        <View style={[styles.tags, { borderTopColor: theme.border }]}>
          <Text variant="caption" colorRole="inkMuted">
            {entity.topicTags.map((tag) => humanizeToken(tag)).join(' · ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: space['3'],
  },
  name: {
    gap: space['1'],
  },
  label: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tags: {
    paddingTop: space['2'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
