/**
 * Compact entity preview panel anchored over the Explore map. One dense card:
 * Sora title, mono place/year meta, 1–2 line dek, single primary CTA. Clears
 * map attribution (ADR-024 §8) and drives assistive-tech focus on selection
 * (MOB-017).
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  LiftedSurface,
  Text,
  useAccessibilityFocus,
  useThemeColors,
  space,
} from '@/ui';
import { featureMetaLine, type PreviewMetaFeature } from './explore-meta';
import { ExploreChromeFrame } from './explore-chrome';

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
};

const MIN_TOUCH = 44;

export function EntityPreviewSheet({ feature, onOpenEntity, onClose }: EntityPreviewSheetProps) {
  const theme = useThemeColors();
  const { ref: sheetRef, focus } = useAccessibilityFocus();

  useEffect(() => {
    if (feature) focus();
  }, [feature?.entityId, focus]);

  if (!feature) return null;

  const meta = featureMetaLine(feature);
  const dek = feature.properties.oneLineStory?.trim();

  return (
    <View
      style={styles.anchor}
      pointerEvents="box-none"
      testID="entity-preview-sheet"
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      <ExploreChromeFrame shadow="md" accentEdge style={styles.sheetFrame}>
        <View
          ref={sheetRef}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`Preview: ${feature.label}. ${meta}${dek ? `. ${dek}` : ''}`}
          accessibilityHint="Swipe through controls to open the full record or close this preview."
        >
          <LiftedSurface
            gradient="surfaceLift"
            shadow="none"
            paddingKey="3"
            style={[styles.sheet, { borderColor: theme.border }]}
            contentStyle={styles.sheetInner}
          >
            <View style={styles.topRow}>
              <View style={styles.titleBlock}>
                <Text variant="subtitle" isHeading numberOfLines={2} style={styles.title}>
                  {feature.label}
                </Text>
                <Text variant="code" colorRole="inkMuted" numberOfLines={1}>
                  {meta}
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

            {dek ? (
              <Text variant="bodySmall" colorRole="inkMuted" numberOfLines={2} style={styles.dek}>
                {dek}
              </Text>
            ) : null}

            <Button
              label="View full record"
              variant="primary"
              onPress={() => onOpenEntity(feature.entityId)}
              accessibilityLabel={`View full record for ${feature.label}`}
            />
          </LiftedSurface>
        </View>
      </ExploreChromeFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetFrame: {
    marginHorizontal: space['2'],
    marginBottom: 40,
  },
  sheet: {
    gap: space['2'],
  },
  sheetInner: {
    gap: space['2'],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space['2'],
  },
  titleBlock: {
    flex: 1,
    gap: space['1'],
  },
  title: {
    flexShrink: 1,
  },
  close: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dek: {
    marginTop: -space['1'],
  },
});
