/**
 * Entity preview bottom sheet (MOB-012).
 *
 * Tapping a map point or a list row opens this. It is a lightweight bottom sheet
 * built from MOB-007 primitives (Surface/Text/Button) — NOT a new gesture/sheet
 * dependency (the bead forbids silent dep growth). It shows the already-known,
 * redacted preview fields and a single link into the full entity route
 * (`/entity/[id]`), whose CONTENT is MOB-014's job — this sheet only links to it.
 *
 * Accessibility: the sheet is a modal dialog (`accessibilityViewIsModal`) with a
 * 44pt close target; the whole panel is announced. It is anchored above the map
 * attribution so it never fully occludes the license text (ADR-024 §8).
 *
 * Focus movement (MOB-017): this sheet mounts OVER the map on the same screen — not a route
 * push — so neither VoiceOver nor TalkBack move focus here on their own the way they would for
 * a new screen. Selecting a NEW feature (id changes, including from no-selection) drives explicit
 * assistive-tech focus onto the panel via `useAccessibilityFocus`, so a screen-reader user who
 * just activated a map point or list row lands directly on the preview, not stranded on whatever
 * they pressed a moment ago.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Surface, Text, useAccessibilityFocus, useThemeColors } from '@/ui';
import { featureSubtitle, type ExploreFeature } from './explore-feature';

export type EntityPreviewSheetProps = {
  readonly feature: ExploreFeature | null;
  readonly onOpenEntity: (entityId: string) => void;
  readonly onClose: () => void;
};

export function EntityPreviewSheet({ feature, onOpenEntity, onClose }: EntityPreviewSheetProps) {
  const theme = useThemeColors();
  const { ref: sheetRef, focus } = useAccessibilityFocus();

  useEffect(() => {
    if (feature) focus();
  }, [feature?.entityId, focus]);

  if (!feature) return null;

  return (
    <View
      style={styles.anchor}
      pointerEvents="box-none"
      testID="entity-preview-sheet"
      accessibilityViewIsModal
    >
      <Surface
        ref={sheetRef}
        tone="surfaceRaised"
        bordered
        paddingKey="4"
        radiusKey="lg"
        style={[styles.sheet, { borderColor: theme.border }]}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Preview: ${feature.label}. ${featureSubtitle(feature)}`}
      >
        <View style={styles.headerRow}>
          <Text variant="subtitle" isHeading style={styles.title} numberOfLines={2}>
            {feature.label}
          </Text>
          <Button
            label="Close"
            variant="ghost"
            onPress={onClose}
            accessibilityLabel="Close preview"
          />
        </View>

        <Text variant="bodySmall" colorRole="inkMuted">
          {featureSubtitle(feature)}
        </Text>

        {feature.properties.oneLineStory ? (
          <Text variant="body" style={styles.story} numberOfLines={3}>
            {feature.properties.oneLineStory}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="View full record"
            variant="primary"
            onPress={() => onOpenEntity(feature.entityId)}
            accessibilityLabel={`View full record for ${feature.label}`}
          />
        </View>
      </Surface>
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
  sheet: {
    margin: 12,
    marginBottom: 44, // clears the bottom-left map attribution
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  story: {
    marginTop: 4,
  },
  actions: {
    marginTop: 8,
  },
});
