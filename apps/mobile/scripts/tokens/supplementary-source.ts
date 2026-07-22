/**
 * Token values with no source under `brand/tokens` (which ships only
 * colors.json/typography.json/brand.css — no spacing, radius, motion, or
 * type-scale files). Each constant below is cited to where it actually comes
 * from so nothing here reads as invented.
 */

/**
 * Spacing scale, rem units, carried over verbatim from the shipped web
 * design system: packages/ui/src/tokens/spacing.ts `space` (4px base rhythm).
 * Converted to React Native dp at render time using 1rem = 16dp, RN's
 * standard density-independent-pixel base (RN has no native rem/em unit).
 */
export const SPACE_REM: Record<string, number> = {
  '0': 0,
  '1': 0.25,
  '2': 0.5,
  '3': 0.75,
  '4': 1,
  '5': 1.25,
  '6': 1.5,
  '8': 2,
  '10': 2.5,
  '12': 3,
  '16': 4,
  '20': 5,
  '24': 6,
};
export const REM_TO_DP = 16;

/**
 * Radius scale, px, carried over verbatim from
 * packages/ui/src/tokens/foundation.ts `borders` + tokens.css `--ds-radius-full`.
 */
export const RADIUS_PX = {
  none: 0,
  sm: 8,
  md: 16,
  lg: 28,
  full: 999,
} as const;

/**
 * Motion tokens, carried over verbatim from
 * packages/ui/src/tokens/foundation.ts `motion`. `easingStandardCss` is kept
 * as the literal source string; the generator also emits its parsed numeric
 * control points (`easingStandardBezier`) for direct use with
 * react-native-reanimated's `Easing.bezier(x1, y1, x2, y2)`.
 */
export const MOTION_MS = {
  durationInstant: 0,
  durationFast: 160,
  durationBase: 280,
  durationSlow: 480,
} as const;
export const EASING_STANDARD_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Type scale (role -> size/lineHeight/weight). No canonical type-scale token
 * exists anywhere in the repo today: apps/web's shell.css sets font-size via
 * ad hoc per-component `clamp()` values, not a shared scale export, so there
 * is nothing authoritative to mirror. This is a new, deterministic
 * construction for mobile — a standard modular ramp on a 16px base, paired
 * with the brand's actual type roles (display/uiBody/editorial/dataMono from
 * brand/tokens/typography.json). Flag for reconciliation if/when web adopts
 * a shared type-scale token; until then this is mobile's own, not "the same
 * values" borrowed from an existing source because none exists.
 */
export const TYPE_SCALE = {
  display: { size: 34, lineHeight: 40, weight: '600', family: 'display' as const },
  title: { size: 26, lineHeight: 32, weight: '600', family: 'display' as const },
  subtitle: { size: 20, lineHeight: 27, weight: '600', family: 'uiBody' as const },
  body: { size: 16, lineHeight: 24, weight: '400', family: 'uiBody' as const },
  bodyEmphasis: { size: 16, lineHeight: 24, weight: '600', family: 'uiBody' as const },
  bodySmall: { size: 14, lineHeight: 20, weight: '400', family: 'uiBody' as const },
  caption: { size: 12, lineHeight: 16, weight: '500', family: 'uiBody' as const },
  editorial: { size: 17, lineHeight: 27, weight: '400', family: 'editorial' as const },
  code: { size: 13, lineHeight: 19, weight: '500', family: 'dataMono' as const },
} as const;

/**
 * Logo/clear-space constraints, transcribed from
 * brand/guide/pages/03-usage-rules.png ("Usage Rules", BlackStory Brand
 * Guide v1.0) — read visually, not measured from source vector files (the
 * guide is a flattened PNG export, not editable art). Re-verify against the
 * PDF (`brand/guide/pdf/BlackStory-Brand-Guide.pdf`) if these ever need
 * higher-precision figures than the guide page states.
 */
export const LOGO_CONSTRAINTS = {
  /** Guide p.03 "Minimum Size / Digital: 120 px" (primary lockup). */
  minLockupWidthPx: 120,
  /** Guide p.03 "Minimum Size / Symbol: 16 mm / 96 px". */
  minSymbolSizePx: 96,
  /**
   * Guide p.03 "Clear Space: Always give the logo room to breathe. Maintain
   * clear space around the logo equal to the height of the symbol." i.e. the
   * margin on every side must be >= the rendered symbol's height.
   */
  clearSpaceEqualsSymbolHeight: true,
  /** Guide p.03 "Approved Backgrounds": light lockup on light bg, dark lockup on dark bg. */
  approvedBackgrounds: {
    light: 'Use the light lockup only on light/paper backgrounds.',
    dark: 'Use the dark lockup only on dark/near-black backgrounds.',
    symbolOnly: 'The symbol alone is approved for app icons, favicons, and tight spaces.',
  },
  /** Guide p.03 "Do / Don't": literal prohibitions, not a style preference. */
  prohibited: [
    'Do not recolor the mark (no recoloring/tinting the approved lockup or symbol art).',
    'Do not stretch or squash the mark (must render at its authored aspect ratio).',
    'Do not add effects or shadows to the mark.',
    'Do not rotate the mark.',
  ],
} as const;
