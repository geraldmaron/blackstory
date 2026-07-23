/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 *
 * Legacy bridge for Expo template components under `src/components/**` only.
 * Product screens should use `useThemeColors()` from `@/ui` instead.
 */
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { resolveThemeName } from '@/ui/tokens';

export function useTheme() {
  const scheme = useColorScheme();
  const theme = resolveThemeName(scheme);

  return Colors[theme];
}
