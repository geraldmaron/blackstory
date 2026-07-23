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

export const brandCore = {
  "ebonyInk": "#0A0A0A",
  "archivePaper": "#F4EFE5",
  "sand": "#D8A178",
  "bronze": "#B86B2A",
  "mahogany": "#8E4F2A",
  "copperPin": "#B86B2A"
} as const;

export const themeColors = {
  "light": {
    "canvas": "#F4EFE5",
    "surface": "#F6F2EA",
    "surfaceRaised": "#F8F5EE",
    "ink": "#0A0A0A",
    "inkMuted": "#5C5A57",
    "inkSubtle": "#5C5A57",
    "border": "#D8A178",
    "borderStrong": "#0A0A0A",
    "focusRing": "#0A0A0A",
    "focusRingOffset": "#F4EFE5",
    "inverse": "#0A0A0A",
    "inverseInk": "#F4EFE5",
    "overlay": "rgba(10, 10, 10, 0.55)",
    "accent": "#8E4F2A",
    "accentGraphic": "#B86B2A",
    "accentMuted": "#DCBA9A"
  },
  "dark": {
    "canvas": "#0A0A0A",
    "surface": "#1D1C1C",
    "surfaceRaised": "#2B2A29",
    "ink": "#F4EFE5",
    "inkMuted": "#A29F98",
    "inkSubtle": "#A29F98",
    "border": "#393836",
    "borderStrong": "#F4EFE5",
    "focusRing": "#F4EFE5",
    "focusRingOffset": "#0A0A0A",
    "inverse": "#F4EFE5",
    "inverseInk": "#0A0A0A",
    "overlay": "rgba(0, 0, 0, 0.72)",
    "accent": "#B86B2A",
    "accentGraphic": "#B86B2A",
    "accentMuted": "#D8A178"
  }
} as const;

export const statusColors = {
  "light": {
    "warning": {
      "fg": "#6B4A17",
      "bg": "#F3E4C6",
      "border": "#B87A2A",
      "cue": "Warning"
    },
    "dispute": {
      "fg": "#7A1F3D",
      "bg": "#F1DCE3",
      "border": "#B8395F",
      "cue": "Disputed"
    },
    "error": {
      "fg": "#7A1F1F",
      "bg": "#F3DCD2",
      "border": "#B83A2A",
      "cue": "Error"
    }
  },
  "dark": {
    "warning": {
      "fg": "#F0CE8E",
      "bg": "#3A2A0E",
      "border": "#D6A354",
      "cue": "Warning"
    },
    "dispute": {
      "fg": "#F0B9C9",
      "bg": "#3A1420",
      "border": "#D66E8B",
      "cue": "Disputed"
    },
    "error": {
      "fg": "#F0B3A6",
      "bg": "#3A1610",
      "border": "#D66B54",
      "cue": "Error"
    }
  }
} as const;

export const confidenceColors = {
  "light": {
    "high": {
      "fg": "#215A34",
      "bg": "#DCEBDD",
      "border": "#3E8B54",
      "cue": "High confidence"
    },
    "medium": {
      "fg": "#6B4A17",
      "bg": "#F3E4C6",
      "border": "#B87A2A",
      "cue": "Medium confidence"
    },
    "low": {
      "fg": "#4A453D",
      "bg": "#E7E1D3",
      "border": "#7A7364",
      "cue": "Low confidence"
    }
  },
  "dark": {
    "high": {
      "fg": "#A9D9B4",
      "bg": "#12301C",
      "border": "#5CAD73",
      "cue": "High confidence"
    },
    "medium": {
      "fg": "#F0CE8E",
      "bg": "#3A2A0E",
      "border": "#D6A354",
      "cue": "Medium confidence"
    },
    "low": {
      "fg": "#D4CDBE",
      "bg": "#2B2822",
      "border": "#8F8672",
      "cue": "Low confidence"
    }
  }
} as const;

export type ThemeName = keyof typeof themeColors;
// Widened to plain string per field: the light/dark objects share the same
// key set but different literal hex values per key, and a type meant to
// describe "either theme's role palette" must not pin one theme's exact
// literal values (that would make the other theme's object un-assignable).
export type ThemeRole = { [K in keyof typeof themeColors.light]: string };
export type StatusName = keyof typeof statusColors.light;
export type ConfidenceLevel = keyof typeof confidenceColors.light;
