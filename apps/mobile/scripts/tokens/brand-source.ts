/**
 * Reads the repo's `brand/` kit and derives the full structured token set the
 * mobile app's generated TypeScript constants are rendered from. This module
 * is the single place that touches disk/brand data; render.ts is pure
 * formatting over its output so the two concerns (reading + validating brand
 * source vs. emitting TS text) stay separable and independently testable.
 *
 * Color source of truth (Mobile Full-App redesign / AGENTS.md / docs/ui/brand.md):
 * `brand/tokens/colors.json` aligned with `packages/ui/src/tokens/brand-palette.ts`.
 * Theme derivation mirrors `packages/ui/src/tokens/colors.ts` (Stone, Rule, Surface,
 * Charcoal, copper text #8E4F2A / #D07A32). Typography comes from
 * `brand/tokens/typography.json` + brand.css.
 *
 * Typography: `brand/tokens/typography.json` says `uiBody: "Inter"` (no
 * "Display" suffix) and `display: "Sora SemiBold"`. An earlier commit
 * (6fdec13, "Adopt brand pack v3: ... Inter Display type") did use "Inter
 * Display" for the display role, but apps/web/src/app/layout.tsx's own
 * docblock records that Sora replaced Inter-Display when the current kit
 * landed (2026-07-18), and the live brand/tokens files agree: Sora SemiBold
 * for display, plain Inter for UI/body. "Inter Display" is a superseded,
 * historical value — not used here.
 *
 * Spacing, radius, and motion tokens have no `brand/tokens` source at all
 * (that directory only ships colors.json/typography.json/brand.css) — they
 * are carried over from the one existing, shipped, contrast-tested design
 * system (`packages/ui/src/tokens/{spacing,foundation}.ts`) so mobile does
 * not invent a second, incompatible rhythm. This is cited per-value below.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, ensureContrast } from './color-math';

const BRAND_TOKENS_DIR = join(__dirname, '..', '..', '..', '..', 'brand', 'tokens');

/** Canonical palette keys from brand/tokens/colors.json (docs/ui/brand.md). */
export type BrandPaletteColors = {
  blackInk: string;
  charcoal: string;
  archivePaper: string;
  surface: string;
  copperPin: string;
  copperTextLight: string;
  copperTextDark: string;
  pageSand: string;
  stone: string;
  rule: string;
};

/** Legacy generator output shape kept for mobile call sites (brandCore.*). */
export type BrandCoreColors = {
  ebonyInk: string;
  archivePaper: string;
  sand: string;
  bronze: string;
  mahogany: string;
  copperPin: string;
};

export type BrandTypographyFamilies = {
  display: string;
  uiBody: string;
  editorial: string;
  dataMono: string;
};

export type ThemeRole = {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  border: string;
  borderStrong: string;
  focusRing: string;
  focusRingOffset: string;
  inverse: string;
  inverseInk: string;
  overlay: string;
  /** Text-safe application of the brand accent (must clear 4.5:1 on canvas). */
  accent: string;
  /** Large-scale/graphic-only application (must clear 3:1 on canvas; never body text). */
  accentGraphic: string;
  /** Decorative fill/tint only, never a foreground color. */
  accentMuted: string;
};

export type StatusRole = { fg: string; bg: string; border: string; cue: string };
export type ConfidenceRole = Record<'high' | 'medium' | 'low', StatusRole>;

export type BrandTokens = {
  core: BrandCoreColors;
  typography: BrandTypographyFamilies;
  themes: { light: ThemeRole; dark: ThemeRole };
  status: { light: Record<'warning' | 'dispute' | 'error', StatusRole>; dark: Record<'warning' | 'dispute' | 'error', StatusRole> };
  confidence: { light: ConfidenceRole; dark: ConfidenceRole };
};

function readBrandCssVars(css: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const match of css.matchAll(/--([a-zA-Z0-9-]+):\s*([^;]+);/g)) {
    vars[match[1]] = match[2].trim();
  }
  return vars;
}

function paletteToBrandCore(palette: BrandPaletteColors): BrandCoreColors {
  return {
    ebonyInk: palette.blackInk,
    archivePaper: palette.archivePaper,
    sand: palette.pageSand,
    bronze: palette.copperPin,
    mahogany: palette.copperTextLight,
    copperPin: palette.copperPin,
  };
}

/**
 * Loads typography from brand/tokens and the canonical palette from colors.json.
 */
export function loadBrandCoreSource(): {
  colors: BrandCoreColors;
  palette: BrandPaletteColors;
  typography: BrandTypographyFamilies;
} {
  const palette = JSON.parse(
    readFileSync(join(BRAND_TOKENS_DIR, 'colors.json'), 'utf8'),
  ) as BrandPaletteColors;
  const typographyJson = JSON.parse(
    readFileSync(join(BRAND_TOKENS_DIR, 'typography.json'), 'utf8'),
  ) as { wordmark: string; display: string; uiBody: string; editorial: string; dataMono: string };
  const cssVars = readBrandCssVars(readFileSync(join(BRAND_TOKENS_DIR, 'brand.css'), 'utf8'));

  const cssFontUi = cssVars['blackstory-font-ui'];
  if (!cssFontUi || !cssFontUi.includes(typographyJson.uiBody)) {
    throw new Error(
      `generate-brand-tokens: brand/tokens/typography.json.uiBody ("${typographyJson.uiBody}") ` +
        `disagrees with brand/tokens/brand.css --blackstory-font-ui ("${cssFontUi ?? 'missing'}").`,
    );
  }

  return {
    colors: paletteToBrandCore(palette),
    palette,
    typography: {
      display: typographyJson.display,
      uiBody: typographyJson.uiBody,
      editorial: typographyJson.editorial,
      dataMono: typographyJson.dataMono,
    },
  };
}

/** Minimum WCAG contrast a "text-safe" role must clear against its canvas. */
const MIN_TEXT_CONTRAST = 4.5;
/** Minimum WCAG contrast a "graphic-only" (large-scale, non-text) role must clear. */
const MIN_GRAPHIC_CONTRAST = 3;

function pickTextSafeAccent(canvas: string, candidates: Record<string, string>): string {
  const passing = Object.entries(candidates).find(
    ([, hex]) => contrastRatio(hex, canvas) >= MIN_TEXT_CONTRAST,
  );
  if (!passing) {
    throw new Error(
      `generate-brand-tokens: no brand swatch clears ${MIN_TEXT_CONTRAST}:1 text contrast against canvas ${canvas}. ` +
        `Candidates checked: ${JSON.stringify(candidates)}.`,
    );
  }
  return passing[1];
}

/**
 * Builds the full BrandTokens structure: brand-guide swatches -> semantic UI
 * roles (light + dark), status, and confidence colors. Status/confidence
 * hues have no equivalent in the 6-swatch core brand palette (none of Ebony
 * Ink/Archive Paper/Sand/Bronze/Mahogany/Copper Pin reads as "green" or
 * "amber"); they are carried over verbatim from the shipped, contrast-tested
 * `packages/ui/src/tokens/colors.ts` semantic status/confidence hex values,
 * since inventing a fresh set of accessible status colors from scratch would
 * both duplicate work and risk cross-platform meaning drift (a user should
 * not see a different "high confidence" green on web vs. mobile).
 */
export function buildBrandTokens(): BrandTokens {
  const { colors, palette, typography } = loadBrandCoreSource();
  const {
    blackInk,
    charcoal,
    archivePaper,
    surface,
    copperPin,
    copperTextLight,
    copperTextDark,
    pageSand,
    stone,
    rule,
  } = palette;

  const lightAccent = pickTextSafeAccent(archivePaper, {
    copperTextLight,
    copperPin,
  });
  const lightAccentGraphic = ensureContrast(copperPin, archivePaper, MIN_GRAPHIC_CONTRAST, blackInk);

  const light: ThemeRole = {
    canvas: archivePaper,
    surface,
    surfaceRaised: surface,
    ink: blackInk,
    inkMuted: stone,
    inkSubtle: stone,
    border: rule,
    borderStrong: blackInk,
    focusRing: blackInk,
    focusRingOffset: archivePaper,
    inverse: blackInk,
    inverseInk: archivePaper,
    overlay: 'rgba(10, 10, 10, 0.55)',
    accent: lightAccent,
    accentGraphic: lightAccentGraphic,
    accentMuted: pageSand,
  };

  const darkAccent =
    contrastRatio(copperTextDark, blackInk) >= MIN_TEXT_CONTRAST
      ? copperTextDark
      : ensureContrast(copperTextDark, blackInk, MIN_TEXT_CONTRAST, archivePaper);

  const dark: ThemeRole = {
    canvas: blackInk,
    surface: charcoal,
    surfaceRaised: '#1C1B18',
    ink: archivePaper,
    inkMuted: '#BDB5A9',
    inkSubtle: '#BDB5A9',
    border: '#34302C',
    borderStrong: archivePaper,
    focusRing: archivePaper,
    focusRingOffset: blackInk,
    inverse: archivePaper,
    inverseInk: blackInk,
    overlay: 'rgba(0, 0, 0, 0.72)',
    accent: darkAccent,
    accentGraphic: copperTextDark,
    accentMuted: pageSand,
  };

  // Status/confidence hues verbatim from packages/ui/src/tokens/colors.ts
  // (see docblock above for why these are not brand-swatch-derived).
  const status = {
    light: {
      warning: { fg: '#6B4A17', bg: '#F3E4C6', border: '#B87A2A', cue: 'Warning' },
      dispute: { fg: '#7A1F3D', bg: '#F1DCE3', border: '#B8395F', cue: 'Disputed' },
      error: { fg: '#7A1F1F', bg: '#F3DCD2', border: '#B83A2A', cue: 'Error' },
    },
    dark: {
      warning: { fg: '#F0CE8E', bg: '#3A2A0E', border: '#D6A354', cue: 'Warning' },
      dispute: { fg: '#F0B9C9', bg: '#3A1420', border: '#D66E8B', cue: 'Disputed' },
      error: { fg: '#F0B3A6', bg: '#3A1610', border: '#D66B54', cue: 'Error' },
    },
  };
  const confidence = {
    light: {
      high: { fg: '#215A34', bg: '#DCEBDD', border: '#3E8B54', cue: 'High confidence' },
      medium: { fg: '#6B4A17', bg: '#F3E4C6', border: '#B87A2A', cue: 'Medium confidence' },
      low: { fg: '#4A453D', bg: '#E7E1D3', border: '#7A7364', cue: 'Low confidence' },
    },
    dark: {
      high: { fg: '#A9D9B4', bg: '#12301C', border: '#5CAD73', cue: 'High confidence' },
      medium: { fg: '#F0CE8E', bg: '#3A2A0E', border: '#D6A354', cue: 'Medium confidence' },
      low: { fg: '#D4CDBE', bg: '#2B2822', border: '#8F8672', cue: 'Low confidence' },
    },
  };

  assertAccessible({ core: colors, typography, themes: { light, dark }, status, confidence });

  return { core: colors, typography, themes: { light, dark }, status, confidence };
}

/** Fails generation outright if a critical text/UI pair does not clear WCAG AA. */
function assertAccessible(tokens: BrandTokens): void {
  for (const [name, theme] of Object.entries(tokens.themes) as ['light' | 'dark', ThemeRole][]) {
    const textPairs: [string, string, string][] = [
      ['ink/canvas', theme.ink, theme.canvas],
      ['ink/surface', theme.ink, theme.surface],
      ['inkMuted/canvas', theme.inkMuted, theme.canvas],
      ['accent/canvas', theme.accent, theme.canvas],
      ['inverseInk/inverse', theme.inverseInk, theme.inverse],
    ];
    for (const [label, fg, bg] of textPairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < MIN_TEXT_CONTRAST) {
        throw new Error(
          `generate-brand-tokens: ${name} theme "${label}" contrast ${ratio.toFixed(2)}:1 ` +
            `is below the required ${MIN_TEXT_CONTRAST}:1 (fg ${fg} on bg ${bg}).`,
        );
      }
    }
    const graphicPairs: [string, string, string][] = [
      ['borderStrong/canvas', theme.borderStrong, theme.canvas],
      ['focusRing/canvas', theme.focusRing, theme.canvas],
      ['accentGraphic/canvas', theme.accentGraphic, theme.canvas],
    ];
    for (const [label, fg, bg] of graphicPairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < MIN_GRAPHIC_CONTRAST) {
        throw new Error(
          `generate-brand-tokens: ${name} theme "${label}" contrast ${ratio.toFixed(2)}:1 ` +
            `is below the required ${MIN_GRAPHIC_CONTRAST}:1 (fg ${fg} on bg ${bg}).`,
        );
      }
    }
    for (const [statusName, pair] of Object.entries(tokens.status[name])) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      if (ratio < MIN_TEXT_CONTRAST) {
        throw new Error(
          `generate-brand-tokens: ${name} status "${statusName}" contrast ${ratio.toFixed(2)}:1 below ${MIN_TEXT_CONTRAST}:1.`,
        );
      }
    }
    for (const [level, pair] of Object.entries(tokens.confidence[name])) {
      const ratio = contrastRatio(pair.fg, pair.bg);
      if (ratio < MIN_TEXT_CONTRAST) {
        throw new Error(
          `generate-brand-tokens: ${name} confidence "${level}" contrast ${ratio.toFixed(2)}:1 below ${MIN_TEXT_CONTRAST}:1.`,
        );
      }
    }
  }
}
