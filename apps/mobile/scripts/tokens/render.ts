/**
 * Pure formatting: turns a BrandTokens + supplementary constants into the
 * exact TS file text committed under apps/mobile/src/ui/tokens/generated/.
 * No disk I/O here — brand-source.ts owns reading brand/, this module only
 * stringifies. Keeping this pure and disk-free is what makes the no-drift
 * test (src/ui/tokens/__tests__/no-drift.test.ts) cheap and exact: it calls
 * the same render function the CLI does and diffs the result against the
 * committed files, byte for byte, with no timestamps or non-determinism.
 */
import { parseCubicBezier } from './color-math';
import type { BrandTokens } from './brand-source';
import {
  EASING_STANDARD_CSS,
  LOGO_CONSTRAINTS,
  MOTION_MS,
  RADIUS_PX,
  REM_TO_DP,
  SPACE_REM,
  TYPE_SCALE,
} from './supplementary-source';

const HEADER = `/**
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
`;

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function renderColors(tokens: BrandTokens): string {
  return (
    HEADER +
    `
export const brandCore = ${json(tokens.core)} as const;

export const themeColors = ${json(tokens.themes)} as const;

export const statusColors = ${json(tokens.status)} as const;

export const confidenceColors = ${json(tokens.confidence)} as const;

export type ThemeName = keyof typeof themeColors;
// Widened to plain string per field: the light/dark objects share the same
// key set but different literal hex values per key, and a type meant to
// describe "either theme's role palette" must not pin one theme's exact
// literal values (that would make the other theme's object un-assignable).
export type ThemeRole = { [K in keyof typeof themeColors.light]: string };
export type StatusName = keyof typeof statusColors.light;
export type ConfidenceLevel = keyof typeof confidenceColors.light;
`
  );
}

export function renderSpacing(): string {
  const dp: Record<string, number> = {};
  for (const [key, rem] of Object.entries(SPACE_REM)) {
    dp[key] = Math.round(rem * REM_TO_DP * 100) / 100;
  }
  return (
    HEADER +
    `
/** Spacing scale in dp (React Native's density-independent unit). */
export const space = ${json(dp)} as const;

export type SpaceKey = keyof typeof space;
`
  );
}

export function renderRadius(): string {
  return (
    HEADER +
    `
/** Corner-radius scale in dp. */
export const radius = ${json(RADIUS_PX)} as const;

export type RadiusKey = keyof typeof radius;
`
  );
}

export function renderMotion(): string {
  const bezier = parseCubicBezier(EASING_STANDARD_CSS);
  return (
    HEADER +
    `
/** Duration tokens in milliseconds. */
export const duration = ${json(MOTION_MS)} as const;

/** Source CSS easing curve (documentation / web parity reference). */
export const easingStandardCss = ${json(EASING_STANDARD_CSS)} as const;

/**
 * Parsed control points of easingStandardCss, ready for
 * react-native-reanimated's Easing.bezier(x1, y1, x2, y2). Order: [x1, y1, x2, y2].
 */
export const easingStandardBezier = ${json(bezier)} as const;

export type DurationKey = keyof typeof duration;
`
  );
}

export function renderTypography(tokens: BrandTokens): string {
  return (
    HEADER +
    `
/** Brand type-family names, from brand/tokens/typography.json. */
export const fontFamilies = ${json(tokens.typography)} as const;

/** Role -> size/lineHeight/weight/family-role scale (see supplementary-source.ts for provenance). */
export const typeScale = ${json(TYPE_SCALE)} as const;

export type FontFamilyRole = keyof typeof fontFamilies;
export type TypeScaleRole = keyof typeof typeScale;
`
  );
}

export function renderLogo(): string {
  return (
    HEADER +
    `
/** Logo minimum-size and clear-space constraints (see supplementary-source.ts for provenance). */
export const logoConstraints = ${json(LOGO_CONSTRAINTS)} as const;
`
  );
}

export function renderAll(tokens: BrandTokens): Record<string, string> {
  return {
    'colors.generated.ts': renderColors(tokens),
    'spacing.generated.ts': renderSpacing(),
    'radius.generated.ts': renderRadius(),
    'motion.generated.ts': renderMotion(),
    'typography.generated.ts': renderTypography(tokens),
    'logo.generated.ts': renderLogo(),
  };
}
