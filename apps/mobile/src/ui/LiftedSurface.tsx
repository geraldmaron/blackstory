/**
 * Compact elevated panel: optional soft shadow + optional gradient backdrop.
 * Does not alter default Surface — use for Search/More/entity focal modules only.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { GradientBackdrop } from './GradientPanel';
import {
  radius,
  space,
  useShadowStyle,
  useThemeColors,
  type GradientName,
  type RadiusKey,
  type ShadowLevel,
  type SpaceKey,
} from './tokens';

export type LiftedSurfaceProps = Omit<ViewProps, 'style'> & {
  /** Background role when no gradient is applied. */
  tone?: 'canvas' | 'surface' | 'surfaceRaised';
  radiusKey?: RadiusKey;
  paddingKey?: SpaceKey;
  bordered?: boolean;
  /** Soft brand shadow tier; defaults to `sm`. Pass `none` to opt out. */
  shadow?: ShadowLevel;
  /** Optional gradient preset layered beneath content. */
  gradient?: GradientName;
  /** Style applied to the outer chrome (shadow, border, radius). */
  style?: ViewProps['style'];
  /** Style applied to the inner content wrapper (gap, flex, etc.). */
  contentStyle?: ViewProps['style'];
  children?: ReactNode;
};

export function LiftedSurface({
  tone = 'surface',
  radiusKey = 'md',
  paddingKey,
  bordered = true,
  shadow = 'sm',
  gradient,
  style,
  contentStyle,
  children,
  ...rest
}: LiftedSurfaceProps) {
  const theme = useThemeColors();
  const shadowStyle = useShadowStyle(shadow);

  return (
    <View
      style={[
        shadowStyle,
        {
          borderRadius: radius[radiusKey],
          borderWidth: bordered ? 1 : 0,
          borderColor: bordered ? theme.border : undefined,
          overflow: 'hidden',
          backgroundColor: gradient ? undefined : theme[tone],
        },
        style,
      ]}
      {...rest}
    >
      {gradient ? <GradientBackdrop name={gradient} /> : null}
      <View
        style={[
          styles.content,
          paddingKey ? { padding: space[paddingKey] } : undefined,
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'relative',
  },
});
