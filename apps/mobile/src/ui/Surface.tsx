/**
 * Themed flat container. Flat matte only — hairline border, no shadows.
 * Prefer LiftedSurface for browse edition panels with standard padding slots.
 */
import { forwardRef } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { radius, space, useThemeColors, type RadiusKey, type SpaceKey } from './tokens';

export type SurfaceProps = ViewProps & {
  /** Background role; defaults to 'surface' (one step above canvas). */
  tone?: 'canvas' | 'surface' | 'surfaceRaised';
  radiusKey?: RadiusKey;
  paddingKey?: SpaceKey;
  /** Draws a hairline border in the theme's rule color. */
  bordered?: boolean;
};

export const Surface = forwardRef<View, SurfaceProps>(function Surface(
  { tone = 'surface', radiusKey = 'md', paddingKey, bordered = false, style, ...rest },
  ref,
) {
  const theme = useThemeColors();

  return (
    <View
      ref={ref}
      style={[
        {
          backgroundColor: theme[tone],
          borderRadius: radius[radiusKey],
          padding: paddingKey ? space[paddingKey] : undefined,
          borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
          borderColor: bordered ? theme.border : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
});
