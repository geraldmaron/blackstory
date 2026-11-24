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
 * LINE HEIGHT IS WRITTEN UNSCALED. React Native multiplies a numeric `lineHeight` by the same
 * font-size multiplier it applies to `fontSize` (iOS: `RCTAttributedTextUtils.mm`,
 * `lineHeight * RCTEffectiveFontSizeMultiplierFromTextAttributes`; Android:
 * `TextAttributeProps.effectiveLineHeight`), cap included. This component used to multiply it
 * again by hand, so at the largest accessibility size (about 2.8x) every line box was about
 * 7.9x: a three-word label ran down a whole screen. Seen on the iOS 27 Simulator at
 * accessibility-XXXL on 2026-11-23; do not reintroduce the manual scale without looking at a
 * device.
 */
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { brandCore, useThemeColors } from './tokens';
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

/**
 * Headings follow the system text size less far than reading text, as iOS's own large titles do
 * (34pt to 60pt at the largest size): a 36pt name at 2.8x is 100pt and breaks mid-word on a
 * phone. Body, editorial and meta are never capped here.
 */
const HEADING_MAX_FONT_SCALE: Partial<Record<TextRole, number>> = {
  display: 1.7,
  numeral: 1.4,
  headline: 2,
  title: 2.4,
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
  const headingRoles: TextRole[] = ['display', 'headline', 'title'];
  const resolvedHeading = isHeading ?? headingRoles.includes(variant);

  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (resolvedHeading ? 'header' : undefined)}
      allowFontScaling
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? HEADING_MAX_FONT_SCALE[variant]}
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

/**
 * The accent rule (docs/ui/DESIGN.md section 7.2): one word of a display or headline line set in
 * Newsreader italic, the word the sentence turns on. Ink on paper by inheritance; copper on the
 * ink ground (`onInk`). One per line, one line per screen. Nest it inside a `Text`.
 */
export function Accent({
  children,
  onInk = false,
}: {
  readonly children: string;
  readonly onInk?: boolean;
}) {
  return (
    <RNText
      style={[
        { fontFamily: 'Newsreader-Italic', fontWeight: '400' },
        onInk ? { color: brandCore.copperPin } : null,
      ]}
    >
      {children}
    </RNText>
  );
}
