/**
 * Themed flat container. The brand system is flat by design (elevation is
 * "none" everywhere, matching the web design system — hairline borders carry
 * separation, not shadows); Surface never grows a shadow prop.
 *
 * Forwards its ref to the underlying `View` (MOB-017) so a caller can drive assistive-tech
 * focus onto a Surface directly — e.g. `useAccessibilityFocus`'s `ref` — without needing a
 * separate wrapper element just to be focusable.
 */
import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';
import { radius, space, useThemeColors, type RadiusKey, type SpaceKey } from './tokens';

export type SurfaceProps = ViewProps & {
  /** Background role; defaults to 'surface' (one step above canvas). */
  tone?: 'canvas' | 'surface' | 'surfaceRaised';
  radiusKey?: RadiusKey;
  paddingKey?: SpaceKey;
  /** Draws a 1px hairline border in the theme's border color. */
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
          borderWidth: bordered ? 1 : 0,
          borderColor: bordered ? theme.border : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
});
