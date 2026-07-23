/**
 * Edition Surface panel — flat matte card with optional hairline border.
 * Mobile counterpart of web `.ds-surface` / browse edition panels. No shadows,
 * gradients, or elevation wash; siblings pass `shadow="none"` (the default).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import {
  radius,
  space,
  useShadowStyle,
  useThemeColors,
  type RadiusKey,
  type ShadowLevel,
  type SpaceKey,
} from './tokens';

export type LiftedSurfaceProps = Omit<ViewProps, 'style'> & {
  /** Background role. Defaults to raised Surface on Archive Paper / Charcoal canvas. */
  tone?: 'canvas' | 'surface' | 'surfaceRaised';
  radiusKey?: RadiusKey;
  paddingKey?: SpaceKey;
  bordered?: boolean;
  /**
   * Shadow tier — defaults to `none` (flat matte). Map floating chrome may pass
   * `sm` per ADR-013; browse surfaces must leave the default.
   */
  shadow?: ShadowLevel;
  style?: ViewProps['style'];
  contentStyle?: ViewProps['style'];
  children?: ReactNode;
};

export function LiftedSurface({
  tone = 'surface',
  radiusKey = 'md',
  paddingKey,
  bordered = true,
  shadow = 'none',
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
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: bordered ? theme.border : undefined,
          overflow: 'hidden',
          backgroundColor: theme[tone],
        },
        style,
      ]}
      {...rest}
    >
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
