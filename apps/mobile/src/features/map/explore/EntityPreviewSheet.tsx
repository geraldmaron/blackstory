/**
 * Explore entity preview as sheet content (NarrativeCard anatomy): copper-tick
 * kind slug, Sora name, serif dek (up to 4 lines), labeled at-a-glance facts,
 * and a single primary CTA. Hosted by a parent bottom sheet. Drives
 * assistive-tech focus on selection change (MOB-017).
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Text,
  useAccessibilityFocus,
  useThemeColors,
  space,
} from '@/ui';
import {
  featureAtAGlanceFacts,
  featureKindSlug,
  featureMetaLine,
  type PreviewMetaFeature,
} from './explore-meta';

export type EntityPreviewPreviewFeature = PreviewMetaFeature & {
  readonly entityId: string;
  readonly label: string;
  readonly properties: PreviewMetaFeature['properties'] & {
    readonly oneLineStory?: string;
  };
};

export type EntityPreviewSheetProps = {
  readonly feature: EntityPreviewPreviewFeature | null;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onClose: () => void;
  readonly style?: StyleProp<ViewStyle>;
};

const MIN_TOUCH = 44;
const TICK_WIDTH = 3;

export function EntityPreviewSheet({
  feature,
  onOpenEntity,
  onClose,
  style,
}: EntityPreviewSheetProps) {
  const theme = useThemeColors();
  const { ref: sheetRef, focus } = useAccessibilityFocus();

  useEffect(() => {
    if (feature) focus();
  }, [feature?.entityId, focus]);

  if (!feature) return null;

  const kindSlug = featureKindSlug(feature.kind);
  const meta = featureMetaLine(feature);
  const dek = feature.properties.oneLineStory?.trim();
  const facts = featureAtAGlanceFacts(feature);
  const factsSummary = [`Kind: ${kindSlug}`, ...facts.map((fact) => `${fact.label}: ${fact.value}`)].join(
    '. ',
  );

  return (
    <View
      style={[styles.root, style]}
      testID="entity-preview-sheet"
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      <View
        ref={sheetRef}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Preview: ${feature.label}. ${kindSlug}. ${factsSummary}${
          dek ? `. ${dek}` : ''
        }`}
        accessibilityHint="Swipe through controls to open the full record or close this preview."
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.kindBlock}>
            <View
              style={[styles.copperTick, { backgroundColor: theme.accentGraphic }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <Text variant="code" colorRole="inkMuted" numberOfLines={1} style={styles.kindSlug}>
              {kindSlug}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            accessibilityHint="Returns focus to the map without opening the full record"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [
              styles.close,
              { backgroundColor: pressed ? theme.surfaceRaised : 'transparent' },
            ]}
          >
            <Ionicons name="close" size={20} color={theme.inkMuted} />
          </Pressable>
        </View>

        <Text variant="title" isHeading numberOfLines={2} style={styles.title}>
          {feature.label}
        </Text>

        {dek ? (
          <Text variant="editorial" colorRole="ink" numberOfLines={4} style={styles.dek}>
            {dek}
          </Text>
        ) : (
          <Text variant="bodySmall" colorRole="inkMuted" numberOfLines={3}>
            {meta
              ? `${meta}. Open the full record for claims, timeline, and connected places.`
              : 'Open the full record for claims, timeline, and connected places.'}
          </Text>
        )}

        <View
          style={[styles.factsStrip, { borderTopColor: theme.border }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.fact}>
            <Text variant="caption" colorRole="inkSubtle">
              Kind
            </Text>
            <Text variant="code" colorRole="ink" numberOfLines={2}>
              {kindSlug}
            </Text>
          </View>
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

        <Button
          label="View full record"
          variant="accent"
          onPress={() => onOpenEntity(feature.entityId)}
          accessibilityLabel={`View full record for ${feature.label}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  card: {
    gap: space['2'],
    paddingHorizontal: space['3'],
    paddingTop: space['1'],
    paddingBottom: space['3'],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  kindBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  copperTick: {
    width: TICK_WIDTH,
    height: 14,
    borderRadius: 1,
  },
  kindSlug: {
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  title: {
    flexShrink: 1,
  },
  dek: {
    marginTop: -space['1'],
  },
  factsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['3'],
    paddingTop: space['2'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fact: {
    gap: 2,
    minWidth: 72,
    flexGrow: 1,
    flexBasis: '28%',
  },
  close: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
