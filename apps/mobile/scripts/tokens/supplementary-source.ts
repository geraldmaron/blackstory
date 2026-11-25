/**
 * Token values with no source under `brand/tokens` (which ships only
 * colors.json/typography.json/brand.css — no spacing, radius, motion, or
 * type-scale files). Each constant below is cited to where it actually comes
 * from so nothing here reads as invented.
 */

import { borders, motion } from '../../../../packages/ui/src/tokens/foundation';
import { space } from '../../../../packages/ui/src/tokens/spacing';

/**
 * Spacing, radius and motion are read from the web kit's token modules (docs/ui/DESIGN.md
 * section 11), so the app cannot drift from the web by a hand-copied number. Edit the kit, then
 * re-run the generator.
 *
 * Spacing is rem in the kit and is converted to React Native dp at render time using
 * 1rem = 16dp (RN has no rem unit).
 */
export const SPACE_REM: Record<string, number> = Object.fromEntries(
  Object.entries(space).map(([step, rem]) => [step, Number.parseFloat(rem)]),
);
export const REM_TO_DP = 16;

/**
 * Radius scale in px: 0 for exhibits and sheets, 8 for controls, full for chips (DESIGN.md
 * section 7.4). The kit still carries 14 and 28 until the web retires their last users; the app
 * does not generate them, so a component cannot reach for one. `full` mirrors tokens.css
 * `--ds-radius-full`.
 */
export const RADIUS_PX = {
  none: Number.parseFloat(borders.radiusNone),
  sm: Number.parseFloat(borders.radiusSm),
  full: 999,
} as const;

/**
 * Durations in ms and the standard easing. `EASING_STANDARD_CSS` stays the literal CSS string;
 * the generator also emits its control points for react-native-reanimated's `Easing.bezier`.
 */
export const MOTION_MS = {
  durationInstant: Number.parseFloat(motion.durationInstant),
  durationFast: Number.parseFloat(motion.durationFast),
  durationBase: Number.parseFloat(motion.durationBase),
  durationSlow: Number.parseFloat(motion.durationSlow),
} as const;
export const EASING_STANDARD_CSS = motion.easingStandard;

/**
 * Type scale. The seven roles are the web's (docs/ui/brand.md "Type", DESIGN.md section 7.2):
 * display, headline, title, body, editorial, meta, numeral. The web sizes them with viewport
 * clamps; a phone has one width, so each role takes a fixed size near the low end of its clamp
 * that still survives the system's largest text size. Body has three smaller steps
 * (bodyEmphasis, bodySmall, caption) because rows and captions need them; they are not new roles.
 *
 * Display is a name, a place or a year, never a count. Numeral is for years and decades only.
 */
export const TYPE_SCALE = {
  /** Web --ds-weight-display 800. Once per screen: a record's name, a story's title. */
  display: { size: 36, lineHeight: 40, weight: '800', family: 'display' as const },
  /** Web --ds-weight-headline 700. Screen and section titles. */
  headline: { size: 26, lineHeight: 32, weight: '700', family: 'display' as const },
  /** Web --ds-weight-title 650; the nearest loaded Schibsted cut is 600. Rows and sub-sections. */
  title: { size: 20, lineHeight: 26, weight: '600', family: 'display' as const },
  body: { size: 16, lineHeight: 24, weight: '400', family: 'uiBody' as const },
  bodyEmphasis: { size: 16, lineHeight: 24, weight: '600', family: 'uiBody' as const },
  bodySmall: { size: 14, lineHeight: 20, weight: '400', family: 'uiBody' as const },
  caption: { size: 12, lineHeight: 16, weight: '500', family: 'uiBody' as const },
  editorial: { size: 17, lineHeight: 27, weight: '400', family: 'editorial' as const },
  /** Web --ds-text-meta 13px, Geist Mono; caps and tracking are applied where it is a label. */
  meta: { size: 13, lineHeight: 18, weight: '500', family: 'dataMono' as const },
  /** Web --ds-weight-numeral 800. A year or a decade as a graphic. */
  numeral: { size: 48, lineHeight: 52, weight: '800', family: 'display' as const },
} as const;

/**
 * Logo/clear-space constraints, transcribed from
 * brand/source/generated-2026-07-18/guide/pages/03-usage-rules.png ("Usage Rules", BlackStory Brand
 * Guide v1.0) — read visually, not measured from source vector files (the
 * guide is a flattened PNG export, not editable art). Re-verify against the
 * PDF (`brand/source/generated-2026-07-18/guide/pdf/BlackStory-Brand-Guide.pdf`) if these ever need
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
