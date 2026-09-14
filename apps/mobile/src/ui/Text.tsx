/**
 * Brand-driven Text primitive. Sizes/weights come from the generated type
 * scale (tokens/generated/typography.generated.ts); colors come from the
 * generated theme palette — nothing here is a hardcoded hex or px literal.
 *
 * Dynamic Type: `allowFontScaling` defaults to true (React Native's own
 * default) and is never forced off. `maxFontSizeMultiplier` is left
 * unbounded by default so the system font-scale setting is fully respected;
 * callers laying out a fixed-height header row can opt into a cap via the
 * `maxFontSizeMultiplier` prop, but nothing here disables scaling by default.
 *
 * LINE HEIGHT SCALES WITH THE FONT, AND HAS TO BE DONE BY HAND. React Native
 * multiplies `fontSize` by the OS font scale when `allowFontScaling` is on, but it
 * leaves a numeric `lineHeight` exactly as written — a line box measured in points
 * does not know the text inside it grew. At the largest accessibility size (~3.1x on
 * iOS) a 16pt body in a 24pt line box renders at ~50pt and is cropped to the tops of
 * its own letters: on an iPad at accessibility-XXXL every record row in Explore read
 * as a row of disconnected dashes. So the same multiplier is applied here, capped the
 * same way `maxFontSizeMultiplier` caps the size, which keeps the ratio between the
 * two constant at every text size.
 */
import {
  PixelRatio,
  Text as RNText,
  useWindowDimensions,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { useThemeColors } from './tokens';
import { typeScale, type TypeScaleRole } from './tokens';
import { resolveFontFamily } from './fonts';

export type TextRole = TypeScaleRole;

// Note: React Native's own accessibility props already declare a `role`
// property (the ARIA-style role, e.g. "button"/"alert") — that is NOT the
// same concept as this component's type-scale role, so RN's `role` is
// omitted here and this component's scale selector is named `variant` to
// avoid the collision entirely (intersecting two incompatible `role` types
// silently collapses to `never` and breaks every prop below it).
export type TextProps = Omit<RNTextProps, 'role'> & {
  /** Type-scale variant; defaults to 'body'. */
  variant?: TextRole;
  /** Semantic color role from the theme palette; defaults to 'ink'. */
  colorRole?: 'ink' | 'inkMuted' | 'inkSubtle' | 'accent' | 'inverseInk';
  /** Marks display/title text as a screen-reader heading. */
  isHeading?: boolean;
};

export function Text({
  variant = 'body',
  colorRole = 'ink',
  isHeading,
  style,
  maxFontSizeMultiplier,
  accessibilityRole,
  ...rest
}: TextProps) {
  const theme = useThemeColors();
  const scale = typeScale[variant];
  const family = resolveFontFamily(scale.family, scale.weight);
  const lineHeight = scale.lineHeight * useFontScale(maxFontSizeMultiplier);
  const headingRoles: TextRole[] = ['display', 'title', 'subtitle', 'masthead', 'entityTitle'];
  const resolvedHeading = isHeading ?? headingRoles.includes(variant);

  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (resolvedHeading ? 'header' : undefined)}
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        {
          fontFamily: family,
          fontSize: scale.size,
          lineHeight,
          fontWeight: scale.weight as TextStyle['fontWeight'],
          color: theme[colorRole],
        },
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * The multiplier React Native is about to apply to `fontSize`, so `lineHeight` can be
 * given the same one.
 *
 * Read from `useWindowDimensions()` rather than `PixelRatio.getFontScale()` because the
 * hook re-renders when the OS text size changes while the app is open — a one-shot read
 * would leave every already-mounted screen with the old line boxes until it remounted.
 * `PixelRatio` stays as the fallback for the case where the window reports no font scale.
 *
 * `maxFontSizeMultiplier` is honored the same way RN honors it, including its convention
 * that `0` means "no cap"; a caller who capped the size would otherwise get a line box
 * that kept growing past text that had stopped.
 */
function useFontScale(maxFontSizeMultiplier: number | null | undefined): number {
  const { fontScale } = useWindowDimensions();
  const systemScale =
    Number.isFinite(fontScale) && fontScale > 0 ? fontScale : PixelRatio.getFontScale();
  if (typeof maxFontSizeMultiplier === 'number' && maxFontSizeMultiplier > 0) {
    return Math.min(systemScale, maxFontSizeMultiplier);
  }
  return systemScale;
}
