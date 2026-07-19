/**
 * Themed flat container. The brand system is flat by design (elevation is
 * "none" everywhere, matching the web design system — hairline borders carry
 * separation, not shadows); Surface never grows a shadow prop.
 */
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

export function Surface({
  tone = 'surface',
  radiusKey = 'md',
  paddingKey,
  bordered = false,
  style,
  ...rest
}: SurfaceProps) {
  const theme = useThemeColors();

  return (
    <View
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
}
