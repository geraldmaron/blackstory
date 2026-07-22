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
 */
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
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
  const headingRoles: TextRole[] = ['display', 'title', 'subtitle'];
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
          lineHeight: scale.lineHeight,
          fontWeight: scale.weight as TextStyle['fontWeight'],
          color: theme[colorRole],
        },
        style,
      ]}
      {...rest}
    />
  );
}
