/**
 * Compact at-a-glance facts on entity detail — labeled Era / Place / Precision /
 * Status before long narrative sections (summary-before-story).
 */
import { StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';
import { humanizeToken } from '../format';
import type { Entity } from '../types';
import { SectionHeading } from './SectionHeading';

export type AtAGlanceSectionProps = {
  readonly entity: Entity;
};

type Fact = { readonly label: string; readonly value: string };

function factsFor(entity: Entity): readonly Fact[] {
  const out: Fact[] = [];
  const kind = humanizeToken(entity.kind);
  if (kind) out.push({ label: 'Kind', value: kind });
  const place = entity.jurisdictionLabel.trim() || entity.locationLabel.trim();
  if (place && place.toLowerCase() !== 'unknown jurisdiction' && place.toLowerCase() !== 'unknown location') {
    out.push({ label: 'Place', value: place });
  }
  const era = entity.eraBuckets?.[0]?.trim();
  if (era) out.push({ label: 'Era', value: humanizeToken(era) });
  if (entity.locationPrecision) {
    out.push({ label: 'Precision', value: humanizeToken(entity.locationPrecision) });
  }
  if (entity.status) out.push({ label: 'Status', value: humanizeToken(entity.status) });
  if (entity.recordMaturity) {
    out.push({ label: 'Maturity', value: humanizeToken(entity.recordMaturity) });
  }
  return out;
}

export function AtAGlanceSection({ entity }: AtAGlanceSectionProps) {
  const theme = useThemeColors();
  const facts = factsFor(entity);
  if (facts.length === 0) return null;

  return (
    <View style={styles.wrap} testID="entity-at-a-glance">
      <SectionHeading level={2}>At a glance</SectionHeading>
      <View style={[styles.strip, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {facts.map((fact) => (
          <View key={fact.label} style={styles.fact}>
            <Text variant="caption" colorRole="inkSubtle">
              {fact.label}
            </Text>
            <Text variant="code" colorRole="ink" numberOfLines={2}>
              {fact.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space['2'],
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['3'],
    padding: space['3'],
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fact: {
    gap: 2,
    minWidth: 96,
    flexGrow: 1,
    flexBasis: '40%',
  },
});
