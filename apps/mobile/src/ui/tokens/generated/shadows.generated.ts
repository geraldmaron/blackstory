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

/**
 * Web `--ds-shadow-sheet` / `-lift` / `-float` (packages/ui/src/styles/tokens.css), layer for
 * layer, as React Native `boxShadow` values.
 */
export const shadows = {
  "light": {
    "sheet": [
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 1,
        "spreadDistance": 0,
        "color": "rgba(10, 10, 10, 0.06)"
      },
      {
        "offsetX": 0,
        "offsetY": 4,
        "blurRadius": 12,
        "spreadDistance": -2,
        "color": "rgba(10, 10, 10, 0.07)"
      },
      {
        "offsetX": 0,
        "offsetY": 22,
        "blurRadius": 48,
        "spreadDistance": -18,
        "color": "rgba(10, 10, 10, 0.18)"
      }
    ],
    "lift": [
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "rgba(10, 10, 10, 0.06)"
      },
      {
        "offsetX": 0,
        "offsetY": 10,
        "blurRadius": 22,
        "spreadDistance": -6,
        "color": "rgba(10, 10, 10, 0.12)"
      },
      {
        "offsetX": 0,
        "offsetY": 36,
        "blurRadius": 70,
        "spreadDistance": -24,
        "color": "rgba(10, 10, 10, 0.26)"
      }
    ],
    "float": [
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "rgba(10, 10, 10, 0.08)"
      },
      {
        "offsetX": 0,
        "offsetY": 12,
        "blurRadius": 32,
        "spreadDistance": -8,
        "color": "rgba(10, 10, 10, 0.16)"
      },
      {
        "offsetX": 0,
        "offsetY": 40,
        "blurRadius": 80,
        "spreadDistance": -30,
        "color": "rgba(10, 10, 10, 0.22)"
      }
    ]
  },
  "dark": {
    "sheet": [
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 1,
        "spreadDistance": 0,
        "color": "rgba(0, 0, 0, 0.4)"
      },
      {
        "offsetX": 0,
        "offsetY": 6,
        "blurRadius": 14,
        "spreadDistance": -2,
        "color": "rgba(0, 0, 0, 0.38)"
      },
      {
        "offsetX": 0,
        "offsetY": 26,
        "blurRadius": 56,
        "spreadDistance": -18,
        "color": "rgba(0, 0, 0, 0.6)"
      }
    ],
    "lift": [
      {
        "offsetX": 0,
        "offsetY": 2,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "rgba(0, 0, 0, 0.4)"
      },
      {
        "offsetX": 0,
        "offsetY": 14,
        "blurRadius": 26,
        "spreadDistance": -6,
        "color": "rgba(0, 0, 0, 0.46)"
      },
      {
        "offsetX": 0,
        "offsetY": 44,
        "blurRadius": 80,
        "spreadDistance": -24,
        "color": "rgba(0, 0, 0, 0.7)"
      }
    ],
    "float": [
      {
        "offsetX": 0,
        "offsetY": 1,
        "blurRadius": 2,
        "spreadDistance": 0,
        "color": "rgba(0, 0, 0, 0.5)"
      },
      {
        "offsetX": 0,
        "offsetY": 14,
        "blurRadius": 36,
        "spreadDistance": -8,
        "color": "rgba(0, 0, 0, 0.5)"
      },
      {
        "offsetX": 0,
        "offsetY": 44,
        "blurRadius": 90,
        "spreadDistance": -30,
        "color": "rgba(0, 0, 0, 0.7)"
      }
    ]
  }
} as const;
