/**
 * Purely decorative hairline separator. Hidden from assistive tech
 * (importantForAccessibility="no", accessibilityElementsHidden) since a
 * visual rule between rows carries no independent semantic content — the
 * surrounding rows' own accessibility labels/order already convey structure.
 */
import { View, type ViewProps } from 'react-native';
import { useThemeColors } from './tokens';

export type DividerProps = ViewProps & {
  orientation?: 'horizontal' | 'vertical';
};

export function Divider({ orientation = 'horizontal', style, ...rest }: DividerProps) {
  const theme = useThemeColors();
  const isHorizontal = orientation === 'horizontal';

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          backgroundColor: theme.border,
          width: isHorizontal ? '100%' : 1,
          height: isHorizontal ? 1 : '100%',
        },
        style,
      ]}
      {...rest}
    />
  );
}
