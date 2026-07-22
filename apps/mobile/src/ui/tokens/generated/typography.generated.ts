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

/** Brand type-family names, from brand/tokens/typography.json. */
export const fontFamilies = {
  "display": "Sora SemiBold",
  "uiBody": "Inter",
  "editorial": "Source Serif 4",
  "dataMono": "IBM Plex Mono"
} as const;

/** Role -> size/lineHeight/weight/family-role scale (see supplementary-source.ts for provenance). */
export const typeScale = {
  "display": {
    "size": 34,
    "lineHeight": 40,
    "weight": "600",
    "family": "display"
  },
  "title": {
    "size": 26,
    "lineHeight": 32,
    "weight": "600",
    "family": "display"
  },
  "subtitle": {
    "size": 20,
    "lineHeight": 27,
    "weight": "600",
    "family": "uiBody"
  },
  "body": {
    "size": 16,
    "lineHeight": 24,
    "weight": "400",
    "family": "uiBody"
  },
  "bodyEmphasis": {
    "size": 16,
    "lineHeight": 24,
    "weight": "600",
    "family": "uiBody"
  },
  "bodySmall": {
    "size": 14,
    "lineHeight": 20,
    "weight": "400",
    "family": "uiBody"
  },
  "caption": {
    "size": 12,
    "lineHeight": 16,
    "weight": "500",
    "family": "uiBody"
  },
  "editorial": {
    "size": 17,
    "lineHeight": 27,
    "weight": "400",
    "family": "editorial"
  },
  "code": {
    "size": 13,
    "lineHeight": 19,
    "weight": "500",
    "family": "dataMono"
  }
} as const;

export type FontFamilyRole = keyof typeof fontFamilies;
export type TypeScaleRole = keyof typeof typeScale;
