/**
 * Color key legend for native Explore — same vocabulary as web MapExperienceLegend.
 * Binding doc: `docs/ui/patterns-map-entity-encoding.md`.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, space, useThemeColors } from '@/ui';
import {
  CONFIDENCE_TIER_COLOR,
  CONFIDENCE_TIER_GLYPH,
  CLUSTER_RADIUS_BY_COUNT,
  DIGNITY_PALETTE,
} from '@/features/map/dignity-palette';
import {
  KIND_FAMILY_ENTRIES,
  SEMANTIC_TONE_ENTRIES,
  type MapEntityGlyph,
} from '@/features/map/kind-encoding';
import { MARKER_RADIUS_MAX, MARKER_RADIUS_MIN } from '@/features/map/marker-size';

const SIZE_SCALE_STEPS = [
  MARKER_RADIUS_MIN,
  Math.round((MARKER_RADIUS_MIN + MARKER_RADIUS_MAX) / 2),
  MARKER_RADIUS_MAX,
] as const;

const CLUSTER_SIZE_ROWS = [
  ['2–9 records', CLUSTER_RADIUS_BY_COUNT[0]![1]],
  ['10–49 records', CLUSTER_RADIUS_BY_COUNT[1]![1]],
  ['50–199 records', CLUSTER_RADIUS_BY_COUNT[2]![1]],
  ['200+ records', CLUSTER_RADIUS_BY_COUNT[3]![1]],
] as const;

const CONFIDENCE_TIER_ROWS = [
  ['high', 'High'],
  ['medium', 'Medium'],
  ['low', 'Low'],
  ['unrated', 'Unrated'],
] as const;

function LegendGlyph({
  glyph,
  shade,
  size = 14,
}: {
  readonly glyph: MapEntityGlyph;
  readonly shade: string;
  readonly size?: number;
}) {
  const ring = glyph === 'ring';
  const thick = glyph === 'square';
  const diamond = glyph === 'diamond';
  return (
    <View
      style={[
        styles.glyph,
        {
          width: size,
          height: size,
          borderRadius: ring ? size / 2 : diamond ? 2 : size / 2,
          backgroundColor: ring ? 'transparent' : shade,
          borderColor: shade,
          borderWidth: thick ? 3 : ring ? 2.5 : 1.5,
          opacity: ring ? 1 : 0.9,
          transform: diamond ? [{ rotate: '45deg' }] : undefined,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function LegendRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  const theme = useThemeColors();
  return (
    <View style={styles.row}>
      {children}
      <Text variant="bodySmall" style={{ color: theme.ink, flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}

function SectionTitle({ children }: { readonly children: string }) {
  const theme = useThemeColors();
  return (
    <Text variant="code" style={[styles.sectionTitle, { color: theme.accent }]}>
      {children}
    </Text>
  );
}

export type MapColorKeyProps = {
  readonly testID?: string;
  /** Compact padding when embedded in the instruments Color key tab. */
  readonly embedded?: boolean;
};

export function MapColorKey({ testID = 'map-color-key', embedded = false }: MapColorKeyProps) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, embedded ? styles.contentEmbedded : undefined]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel="Map color key"
    >
      <Text variant="body" colorRole="inkMuted" style={styles.intro}>
        Shade shows kind family or historical tone. Shape and confidence glyphs are never color
        alone.
      </Text>

      <SectionTitle>Kind families</SectionTitle>
      {KIND_FAMILY_ENTRIES.map(([family, entry]) => (
        <LegendRow key={family} label={entry.label}>
          <LegendGlyph glyph={entry.glyph} shade={entry.shade} />
        </LegendRow>
      ))}

      <SectionTitle>Historical tones</SectionTitle>
      {SEMANTIC_TONE_ENTRIES.map(([tone, entry]) => (
        <LegendRow key={tone} label={entry.label}>
          <View style={[styles.toneSwatch, { backgroundColor: entry.shade }]} />
        </LegendRow>
      ))}

      <SectionTitle>Record size (evidence)</SectionTitle>
      {SIZE_SCALE_STEPS.map((radius) => (
        <LegendRow key={radius} label={`${radius}px radius · evidence depth`}>
          <View
            style={[
              styles.sizeDisc,
              {
                width: radius * 2,
                height: radius * 2,
                borderRadius: radius,
                backgroundColor: DIGNITY_PALETTE.kindPlace,
              },
            ]}
          />
        </LegendRow>
      ))}

      <SectionTitle>Clusters (record count)</SectionTitle>
      {CLUSTER_SIZE_ROWS.map(([label, radius]) => (
        <LegendRow key={label} label={label}>
          <View
            style={[
              styles.sizeDisc,
              {
                width: (radius as number) * 2,
                height: (radius as number) * 2,
                borderRadius: radius as number,
                backgroundColor: DIGNITY_PALETTE.point,
              },
            ]}
          />
        </LegendRow>
      ))}

      <SectionTitle>Confidence</SectionTitle>
      {CONFIDENCE_TIER_ROWS.map(([tier, label]) => (
        <LegendRow key={tier} label={label}>
          <Text variant="code" style={{ color: CONFIDENCE_TIER_COLOR[tier], width: 20 }}>
            {CONFIDENCE_TIER_GLYPH[tier]}
          </Text>
        </LegendRow>
      ))}

      <Text variant="caption" colorRole="inkMuted" style={{ marginTop: space['2'] }}>
        Map plate stays on the dark archive register. Panels follow your device theme.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: space['4'],
    gap: space['2'],
    paddingBottom: space['6'],
  },
  contentEmbedded: {
    paddingHorizontal: space['4'],
    paddingTop: space['2'],
    paddingBottom: space['4'],
  },
  intro: {
    marginBottom: space['2'],
  },
  sectionTitle: {
    letterSpacing: 1,
    marginTop: space['3'],
    marginBottom: space['1'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
    minHeight: 36,
  },
  glyph: {
    marginRight: space['1'],
  },
  toneSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  sizeDisc: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244, 239, 229, 0.35)',
  },
});
