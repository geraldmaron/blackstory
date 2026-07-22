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

/** Logo minimum-size and clear-space constraints (see supplementary-source.ts for provenance). */
export const logoConstraints = {
  "minLockupWidthPx": 120,
  "minSymbolSizePx": 96,
  "clearSpaceEqualsSymbolHeight": true,
  "approvedBackgrounds": {
    "light": "Use the light lockup only on light/paper backgrounds.",
    "dark": "Use the dark lockup only on dark/near-black backgrounds.",
    "symbolOnly": "The symbol alone is approved for app icons, favicons, and tight spaces."
  },
  "prohibited": [
    "Do not recolor the mark (no recoloring/tinting the approved lockup or symbol art).",
    "Do not stretch or squash the mark (must render at its authored aspect ratio).",
    "Do not add effects or shadows to the mark.",
    "Do not rotate the mark."
  ]
} as const;
