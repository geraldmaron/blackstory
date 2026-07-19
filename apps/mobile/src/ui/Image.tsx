/**
 * Themed image primitive wrapping expo-image. `alt` is required (not
 * optional) so every call site is forced to provide an accessible
 * description. When `source` is absent, or the network image fails to load,
 * this renders `EntityMark` (a geometric, non-figurative placeholder) rather
 * than a broken-image glyph or any generated avatar/portrait — the program's
 * explicit non-goal is no decorative anonymous-portrait/avatar system.
 */
import { useState } from 'react';
import { Image as ExpoImage, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { EntityMark, type EntityMarkProps } from './EntityMark';
import { radius, useThemeColors } from './tokens';

export type ImageProps = {
  source: ImageSource | string | number | null | undefined;
  alt: string;
  aspectRatio?: number;
  borderRadiusKey?: keyof typeof radius;
  /** Required so the fallback mark can be labeled meaningfully; also used while loading. */
  fallback: Omit<EntityMarkProps, 'entityName'> & { entityName?: string };
};

export function Image({ source, alt, aspectRatio = 4 / 3, borderRadiusKey = 'sm', fallback }: ImageProps) {
  const theme = useThemeColors();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hasSource = source !== null && source !== undefined;

  const containerStyle = [
    styles.container,
    { aspectRatio, backgroundColor: theme.surfaceRaised, borderRadius: radius[borderRadiusKey] },
  ];

  if (!hasSource || failed) {
    return (
      <View style={containerStyle}>
        <EntityMark entityName={fallback.entityName ?? alt} {...fallback} />
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
        contentFit="cover"
        transition={150}
        style={[StyleSheet.absoluteFill, { borderRadius: radius[borderRadiusKey] }]}
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
