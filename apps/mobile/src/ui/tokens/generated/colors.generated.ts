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
  "ebonyInk": "#111111",
  "archivePaper": "#F7F3EE",
  "sand": "#E7D9C3",
  "bronze": "#B87333",
  "mahogany": "#7A2E22",
  "copperPin": "#D47A42"
} as const;

export const themeColors = {
  "light": {
    "canvas": "#F7F3EE",
    "surface": "#F9F5F1",
    "surfaceRaised": "#FAF7F4",
    "ink": "#111111",
    "inkMuted": "#62605E",
    "inkSubtle": "#62605E",
    "border": "#E7D9C3",
    "borderStrong": "#111111",
    "focusRing": "#111111",
    "focusRingOffset": "#F7F3EE",
    "inverse": "#111111",
    "inverseInk": "#F7F3EE",
    "overlay": "rgba(17, 17, 17, 0.55)",
    "accent": "#7A2E22",
    "accentGraphic": "#CC7640",
    "accentMuted": "#DEC0A3"
  },
  "dark": {
    "canvas": "#111111",
    "surface": "#232323",
    "surfaceRaised": "#313130",
    "ink": "#F7F3EE",
    "inkMuted": "#A7A4A1",
    "inkSubtle": "#A7A4A1",
    "border": "#3F3E3D",
    "borderStrong": "#F7F3EE",
    "focusRing": "#F7F3EE",
    "focusRingOffset": "#111111",
    "inverse": "#F7F3EE",
    "inverseInk": "#111111",
    "overlay": "rgba(0, 0, 0, 0.72)",
    "accent": "#D47A42",
    "accentGraphic": "#D47A42",
    "accentMuted": "#E7D9C3"
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
