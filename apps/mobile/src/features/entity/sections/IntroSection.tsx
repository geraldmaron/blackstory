/**
 * Beat 00 intro: compact BlackStory lockup, editorial media, kind meta,
 * 17 Inter Medium title, lede, and topic tags on canvas with a bottom hairline
 * — Ledger Line, not a Surface card.
 */
import { StyleSheet, View } from 'react-native';
import { Image, Logo, Plate, Text, space, useThemeColors } from '@/ui';
import type { EntityMarkShape } from '@/ui';
import { EntityEditionPanel } from '../EntityEditionPanel';
import { humanizeToken } from '../format';
import type { Entity, EntityKind } from '../types';
import {
  deriveHistoricalFraming,
  historicalFramingLabel,
  isQuietRecord,
} from '../entity-view-model';

/** Compact lockup width (guide digital minimum). */
const BRAND_LOCKUP_WIDTH = 120;

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
};

export function IntroSection({ entity }: IntroSectionProps) {
  const theme = useThemeColors();
  const shape = shapeForKind(entity.kind);
  const kindLabel = humanizeToken(entity.kind);
  const metaLine = buildIntroMetaLine(entity);
  const image = entity.primaryImage;
  const media = {
    source: image?.url,
    alt: image?.alt ?? entity.displayName,
    fallback: {
      entityName: entity.displayName,
      shape,
      kindLabel,
      reason: image ? ('pending-rights-review' as const) : ('absent' as const),
    },
  };

  return (
    <View style={styles.introStack}>
      <View style={styles.brand} testID="entity-intro-brand">
        <Logo variant="lockup" size={BRAND_LOCKUP_WIDTH} />
      </View>
      <EntityEditionPanel
        index="00"
        kicker="Record"
        title={entity.displayName}
        titleLevel={1}
        testID="entity-intro-section"
        headerExtra={
          <Text variant="code" colorRole="inkMuted" numberOfLines={2}>
            {metaLine}
          </Text>
        }
      >
        {image?.credit && !isQuietRecord(entity) ? (
          <Plate {...media} credit={image.credit} />
        ) : (
          // A quiet record keeps its photograph plain: no plate (patterns-living-archive.md).
          <View style={styles.mediaBlock}>
            <Image {...media} aspectRatio={16 / 9} />
            {image?.credit ? (
              <Text variant="caption" colorRole="inkSubtle">
                {image.credit}
              </Text>
            ) : null}
          </View>
        )}

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
      </EntityEditionPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  introStack: {
    gap: space['3'],
  },
  brand: {
    alignSelf: 'flex-start',
  },
  mediaBlock: {
    gap: space['2'],
  },
  tags: {
    paddingTop: space['2'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
