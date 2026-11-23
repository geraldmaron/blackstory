/**
 * Themed image primitive wrapping expo-image. `alt` is required so every call
 * site provides an accessible description. When `source` is absent or the
 * network image fails, this fills the frame with `EntityMark` (geometric,
 * non-figurative) — never a broken-image glyph or generated portrait.
 */
import { useState } from 'react';
import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { EntityMark, type EntityMarkProps } from './EntityMark';
import { useThemeColors } from './tokens';

export type ImageProps = {
  source: ImageSource | string | number | null | undefined;
  alt: string;
  aspectRatio?: number;
  /** `contain` shows the picture whole (a document, a story image); `cover` fills the box. */
  contentFit?: 'cover' | 'contain';
  /** Required so the fallback mark can be labeled meaningfully; also used while loading. */
  fallback: Omit<EntityMarkProps, 'entityName'> & { entityName?: string };
};

export function Image({
  source,
  alt,
  aspectRatio = 4 / 3,
  contentFit = 'cover',
  fallback,
}: ImageProps) {
  const theme = useThemeColors();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hasSource = source !== null && source !== undefined && source !== '';

  const containerStyle = [
    styles.container,
    {
      aspectRatio,
      backgroundColor: theme.surfaceRaised,
      borderColor: theme.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
  ];

  if (!hasSource || failed) {
    return (
      <View style={containerStyle} testID="image-fallback">
        <EntityMark
          entityName={fallback.entityName ?? alt}
          shape={fallback.shape}
          kindLabel={fallback.kindLabel}
          reason={fallback.reason ?? 'absent'}
          fill
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      {!loaded ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.surfaceRaised }]}
        />
      ) : null}
      <ExpoImage
        source={source}
        alt={alt}
        accessible
        accessibilityLabel={alt}
        contentFit={contentFit}
        transition={150}
        style={StyleSheet.absoluteFill}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
