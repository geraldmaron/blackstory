/**
 * Explore entity preview as sheet content (NarrativeCard anatomy): copper accent
 * rule, Sora name, serif dek, RecordFactStrip anatomy, browse controls, and a
 * single primary CTA. Hosted by a parent bottom sheet. Drives assistive-tech
 * focus on selection change (MOB-017).
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  RecordFactStrip,
  Text,
  useAccessibilityFocus,
  useThemeColors,
  space,
} from '@/ui';
import { ExploreChromeFrame, exploreContentInset } from './explore-chrome';
import { exploreRecordFacts } from './explore-preview-facts';
import { featureKindSlug, featureMetaLine, type PreviewMetaFeature } from './explore-meta';

export type EntityPreviewPreviewFeature = PreviewMetaFeature & {
  readonly entityId: string;
  readonly label: string;
  readonly properties: PreviewMetaFeature['properties'] & {
    readonly oneLineStory?: string;
    readonly evidenceCount?: number;
    readonly confidenceTier?: string;
    readonly kindFamily?: string;
  };
};

export type EntityPreviewSheetProps = {
  readonly feature: EntityPreviewPreviewFeature | null;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onClose: () => void;
  readonly onBrowsePrevious?: () => void;
  readonly onBrowseNext?: () => void;
  readonly browsePosition?: { readonly index: number; readonly total: number };
  readonly style?: StyleProp<ViewStyle>;
};

const MIN_TOUCH = 44;

export function EntityPreviewSheet({
  feature,
  onOpenEntity,
  onClose,
  onBrowsePrevious,
  onBrowseNext,
  browsePosition,
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
  const facts = exploreRecordFacts(feature);
  const factsSummary = [`Kind: ${kindSlug}`, ...facts.map((fact) => `${fact.label}: ${fact.value}`)].join(
    '. ',
  );
  const canBrowse =
    browsePosition !== undefined &&
    browsePosition.total > 1 &&
    onBrowsePrevious !== undefined &&
    onBrowseNext !== undefined;

  return (
    <View
      style={[styles.root, style]}
      testID="entity-preview-sheet"
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      <ExploreChromeFrame accentEdge style={styles.frame}>
        <View
          ref={sheetRef}
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`Selected record: ${feature.label}. ${kindSlug}. ${factsSummary}${
            dek ? `. ${dek}` : ''
          }`}
          accessibilityHint="Swipe through controls to open the full record or close this preview."
          style={styles.card}
        >
          <Text variant="code" colorRole="accent" style={styles.kicker}>
            SELECTED RECORD
          </Text>

          <View style={styles.topRow}>
            <View style={styles.kindBlock}>
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

          {canBrowse ? (
            <View style={styles.browseRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous record in view"
                onPress={onBrowsePrevious}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.browseButton,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={theme.accent} />
              </Pressable>
              <Text variant="code" colorRole="inkMuted">
                {browsePosition.index + 1} of {browsePosition.total}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next record in view"
                onPress={onBrowseNext}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.browseButton,
                  { opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={theme.accent} />
              </Pressable>
            </View>
          ) : null}

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

          <RecordFactStrip facts={facts} />

          <Button
            label="Open full record"
            variant="accent"
            onPress={() => onOpenEntity(feature.entityId)}
            accessibilityLabel={`Open full record for ${feature.label}`}
          />
        </View>
      </ExploreChromeFrame>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    paddingHorizontal: exploreContentInset,
  },
  frame: {},
  card: {
    gap: space['2'],
    paddingTop: space['1'],
    paddingBottom: space['3'],
  },
  kicker: {
    letterSpacing: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  kindBlock: {
    flex: 1,
  },
  kindSlug: {
    letterSpacing: 1.2,
    flexShrink: 1,
  },
  browseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space['1'],
  },
  browseButton: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
  },
  dek: {
    marginTop: -space['1'],
  },
  close: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
