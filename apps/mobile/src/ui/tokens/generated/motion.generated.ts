/**
 * GENERATED FILE — DO NOT HAND-EDIT.
 *
 * Produced by apps/mobile/scripts/generate-brand-tokens.ts from brand/tokens
 * (colors.json, typography.json, brand.css) plus the cited supplementary
 * sources in apps/mobile/scripts/tokens/supplementary-source.ts. To change a
 * value, edit the source and re-run:
 *
 *   pnpm --filter @repo/mobile tokens:generate
 *
 * A no-drift test (src/ui/tokens/__tests__/no-drift.test.ts) re-runs the
 * generator and fails CI if this file's committed content differs from what
 * the generator would produce right now.
 */

/** Duration tokens in milliseconds. */
export const duration = {
  "durationInstant": 0,
  "durationFast": 160,
  "durationBase": 280,
  "durationSlow": 480
} as const;

/** Source CSS easing curve (documentation / web parity reference). */
export const easingStandardCss = "cubic-bezier(0.16, 1, 0.3, 1)" as const;

/**
 * Parsed control points of easingStandardCss, ready for
 * react-native-reanimated's Easing.bezier(x1, y1, x2, y2). Order: [x1, y1, x2, y2].
 */
export const easingStandardBezier = [
  0.16,
  1,
  0.3,
  1
] as const;

export type DurationKey = keyof typeof duration;
