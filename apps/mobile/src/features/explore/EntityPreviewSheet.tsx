/**
 * Explore entity preview (Pin Pulse story card): kind glyph, clear title hierarchy,
 * story line, icon meta chips (where / era / evidence / confidence), linked theme
 * hooks, and Open place. Hosted by the Explore sheet. Drives assistive-tech focus
 * on selection change (MOB-017).
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  NavIcon,
  navIconForEntityKind,
  Text,
  useAccessibilityFocus,
  useThemeColors,
  space,
  radius,
  MIN_TOUCH_TARGET,
} from '@/ui';
import { ExploreChromeFrame, exploreContentInset } from './explore-chrome';
import { exploreRecordFacts } from './explore-preview-facts';
import { exploreStoryMeta } from './explore-story-meta';
import { featureMetaLine, type PreviewMetaFeature } from './explore-meta';
import { kindFamilyEncodingFor, isKnownMapKindFamily } from '@/features/map/kind-encoding';
import { recordKindLabel } from '@/features/record-facts/record-facts';
import { openExternalMaps } from '@/features/entity/maps-handoff';

export type EntityPreviewPreviewFeature = PreviewMetaFeature & {
  readonly entityId: string;
  readonly label: string;
  /** Redacted [lng, lat] from the map source when available for external maps hand-off. */
  readonly coordinates?: readonly [number, number];
  readonly properties: PreviewMetaFeature['properties'] & {
    readonly oneLineStory?: string;
    readonly evidenceCount?: number;
    readonly confidenceTier?: string;
    readonly kindFamily?: string;
    readonly topicTags?: readonly string[];
    readonly topicIds?: readonly string[];
    readonly status?: string;
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

const MIN_TOUCH = MIN_TOUCH_TARGET;

function kindDisplayLabel(feature: EntityPreviewPreviewFeature): string {
  const family = feature.properties.kindFamily;
  if (typeof family === 'string' && isKnownMapKindFamily(family)) {
    return kindFamilyEncodingFor(family).label;
  }
  return recordKindLabel(feature.kind);
}

function MetaChip({
  icon,
  label,
  color,
}: {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  readonly color: string;
}) {
  return (
    <View style={styles.metaChip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Ionicons name={icon} size={14} color={color} />
      <Text variant="caption" colorRole="inkMuted" numberOfLines={1} style={styles.metaChipLabel}>
        {label}
      </Text>
    </View>
  );
}

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

  const selected = feature;
  const kindLabel = kindDisplayLabel(selected);
  const meta = featureMetaLine(selected);
  const dek = selected.properties.oneLineStory?.trim();
  const storyMeta = exploreStoryMeta(selected);
  const facts = exploreRecordFacts(selected);
  const factsSummary = [`Kind: ${kindLabel}`, ...facts.map((fact) => `${fact.label}: ${fact.value}`)].join(
    '. ',
  );
  const canBrowse =
    browsePosition !== undefined &&
    browsePosition.total > 1 &&
    onBrowsePrevious !== undefined &&
    onBrowseNext !== undefined;
  const mapCoords = selected.coordinates;
  const hasPublicCoords =
    Array.isArray(mapCoords) &&
    mapCoords.length === 2 &&
    Number.isFinite(mapCoords[0]) &&
    Number.isFinite(mapCoords[1]);
  const hasMetaChips = Boolean(
    storyMeta.where || storyMeta.era || storyMeta.evidence || storyMeta.confidence || storyMeta.status,
  );
  const linkedThemes = storyMeta.themes;

  async function handleOpenInMaps() {
    if (!hasPublicCoords || !mapCoords) return;
    const [lng, lat] = mapCoords;
    await openExternalMaps({
      lat,
      lng,
      label: selected.label,
    });
  }

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
          accessibilityLabel={`Pinned place: ${feature.label}. ${kindLabel}. ${factsSummary}${
            dek ? `. ${dek}` : ''
          }`}
          accessibilityHint="Swipe through controls to open the full place or close this preview."
          style={styles.card}
        >
          <View style={styles.headerRow}>
            <View style={[styles.kindGlyph, { borderColor: theme.border, backgroundColor: theme.surfaceRaised }]}>
              <NavIcon name={navIconForEntityKind(feature.kind)} size={20} selected />
            </View>
            <View style={styles.headerText}>
              <Text variant="code" colorRole="accent" numberOfLines={1} style={styles.kicker}>
                Pinned here
              </Text>
              <Text variant="caption" colorRole="inkMuted" numberOfLines={1}>
                {kindLabel}
                {storyMeta.status ? ` · ${storyMeta.status}` : ''}
              </Text>
            </View>
            {canBrowse ? (
              <View style={styles.browseCluster}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous place nearby"
                  onPress={onBrowsePrevious}
                  hitSlop={8}
                  style={({ pressed }) => [styles.browseButton, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Ionicons name="chevron-back" size={18} color={theme.accent} />
                </Pressable>
                <Text variant="code" colorRole="inkMuted">
                  {browsePosition.index + 1}/{browsePosition.total}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next place nearby"
                  onPress={onBrowseNext}
                  hitSlop={8}
                  style={({ pressed }) => [styles.browseButton, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Ionicons name="chevron-forward" size={18} color={theme.accent} />
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              accessibilityHint="Returns focus to the map without opening the place"
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={feature.label}
            accessibilityHint="Opens the full entity edition screen"
            onPress={() => onOpenEntity(feature.entityId)}
            style={({ pressed }) => [styles.titlePress, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text variant="entityTitle" isHeading numberOfLines={2} style={styles.title}>
              {feature.label}
            </Text>
          </Pressable>

          {dek ? (
            <Text variant="editorial" colorRole="ink" numberOfLines={3} style={styles.dek}>
              {dek}
            </Text>
          ) : (
            <Text variant="caption" colorRole="inkMuted" numberOfLines={2}>
              {meta
                ? `${meta}. Open for claims, timeline, and connected pins.`
                : 'Open for claims, timeline, and connected pins.'}
            </Text>
          )}

          {hasMetaChips ? (
            <View style={styles.metaRow} accessibilityRole="text" accessibilityLabel={factsSummary}>
              {storyMeta.where ? (
                <MetaChip icon="location-outline" label={storyMeta.where} color={theme.inkMuted} />
              ) : null}
              {storyMeta.era ? (
                <MetaChip icon="time-outline" label={storyMeta.era} color={theme.inkMuted} />
              ) : null}
              {storyMeta.evidence ? (
                <MetaChip icon="document-text-outline" label={storyMeta.evidence} color={theme.inkMuted} />
              ) : null}
              {storyMeta.confidence ? (
                <MetaChip icon="shield-checkmark-outline" label={storyMeta.confidence} color={theme.inkMuted} />
              ) : null}
            </View>
          ) : null}

          {linkedThemes && linkedThemes.length > 0 ? (
            <View style={styles.linkedRow} testID="entity-preview-linked">
              <Text variant="code" colorRole="inkMuted" style={styles.linkedKicker}>
                Linked
              </Text>
              <Text variant="caption" colorRole="ink" numberOfLines={1} style={styles.linkedThemes}>
                {linkedThemes.join(' · ')}
              </Text>
            </View>
          ) : null}

          <Button
            label="Open place"
            variant="accent"
            onPress={() => onOpenEntity(feature.entityId)}
            accessibilityLabel={`Open place for ${feature.label}`}
          />
          {hasPublicCoords ? (
            <Button
              label="Open in maps"
              variant="secondary"
              density="compact"
              onPress={() => {
                void handleOpenInMaps();
              }}
              accessibilityLabel={`Open ${feature.label} in Maps at public precision`}
              accessibilityHint="Opens Apple Maps or Google Maps with this place"
            />
          ) : null}
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
    paddingBottom: space['2'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
  },
  kindGlyph: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  kicker: {
    letterSpacing: 0.6,
  },
  browseCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
  },
  browseButton: {
    minHeight: MIN_TOUCH,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePress: {
    alignSelf: 'stretch',
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
  },
  dek: {
    marginTop: -space['1'],
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
    alignItems: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  metaChipLabel: {
    flexShrink: 1,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space['2'],
    flexWrap: 'wrap',
  },
  linkedKicker: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  linkedThemes: {
    flexShrink: 1,
  },
  close: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
});
