/**
 * Record sheet: paper standing off the canvas with the web sheet shadow and an optional
 * hairline border. Mobile counterpart of web `.ds-sheet`
 * (`docs/ui/patterns-living-archive.md`). Pass `shadow="none"` for a panel that sits flush.
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
  /** Plane: `sheet` (default), `lift` while pressed, `float` for chrome over the map. */
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
  shadow = 'sheet',
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
          backgroundColor: theme[tone],
        },
        style,
      ]}
      {...rest}
    >
      <View
        style={[
          styles.content,
          // Clip here, not on the outer view: clipping the outer view cuts off its own shadow.
          { borderRadius: radius[radiusKey] },
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
    overflow: 'hidden',
  },
});
