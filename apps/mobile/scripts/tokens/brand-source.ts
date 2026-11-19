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
/** Web source of truth for the roles that have no `brand/tokens` file (map plate, shadows). */
const UI_TOKENS_CSS = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'styles',
  'tokens.css',
);

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
  /** Light: warm near-white above Surface; dark: warm lift above Charcoal (#1C1B18). */
  surfaceRaised: string;
  /** One step down from Surface / surfaceRaised for press feedback (Archive Paper ladder). */
  surfacePressed: string;
  /** The well a plate or inset list sits in; one value step below canvas. */
  surfaceSunken: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  border: string;
  /** Form-control edge; 3:1 on every surface step (WCAG 1.4.11). */
  borderControl: string;
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

/** Map plate roles, one per `--ds-map-*` custom property in tokens.css. */
export type MapRole = Record<
  'land' | 'water' | 'line' | 'line2' | 'road' | 'label' | 'labelHi' | 'halo',
  string
>;

/** One layer of a web box-shadow, in React Native's `boxShadow` object form. */
export type ShadowLayer = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
};
export type ShadowRole = Record<'sheet' | 'lift' | 'float', ShadowLayer[]>;

export type BrandTokens = {
  core: BrandCoreColors;
  typography: BrandTypographyFamilies;
  themes: { light: ThemeRole; dark: ThemeRole };
  status: {
    light: Record<'warning' | 'dispute' | 'error', StatusRole>;
    dark: Record<'warning' | 'dispute' | 'error', StatusRole>;
  };
  confidence: { light: ConfidenceRole; dark: ConfidenceRole };
  map: { light: MapRole; dark: MapRole };
  shadows: { light: ShadowRole; dark: ShadowRole };
};

/**
 * tokens.css declares each themed role exactly twice: the light value first, then the
 * `[data-theme='dark']` one. Anything else means the file changed shape, so fail loudly.
 */
function readThemedCssVar(css: string, name: string): { light: string; dark: string } {
  const found = [...css.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, 'g'))].map((match) =>
    match[1].trim().replace(/\s+/g, ' '),
  );
  if (found.length !== 2) {
    throw new Error(
      `generate-brand-tokens: expected a light and a dark --${name} in tokens.css, found ${found.length}.`,
    );
  }
  return { light: found[0], dark: found[1] };
}

const MAP_ROLE_CSS_NAMES: Record<keyof MapRole, string> = {
  land: 'land',
  water: 'water',
  line: 'line',
  line2: 'line-2',
  road: 'road',
  label: 'label',
  labelHi: 'label-hi',
  halo: 'halo',
};

function parseShadow(name: string, value: string): ShadowLayer[] {
  const layers = [
    ...value.matchAll(
      /(-?\d+)(?:px)? (-?\d+)px (-?\d+)px(?: (-?\d+)px)? rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/g,
    ),
  ].map(([, x, y, blur, spread, r, g, b, alpha]) => ({
    offsetX: Number(x),
    offsetY: Number(y),
    blurRadius: Number(blur),
    spreadDistance: Number(spread ?? 0),
    color: `rgba(${r}, ${g}, ${b}, ${Number(alpha) / 100})`,
  }));
  if (layers.length === 0 || layers.length !== value.split('rgb(').length - 1) {
    throw new Error(`generate-brand-tokens: could not parse every layer of --${name}: "${value}".`);
  }
  return layers;
}

/** Reads the map plate roles and the sheet/lift/float shadows from the web tokens.css. */
function loadWebTokens(): Pick<BrandTokens, 'map' | 'shadows'> {
  const css = readFileSync(UI_TOKENS_CSS, 'utf8');
  const map = { light: {} as MapRole, dark: {} as MapRole };
  for (const [role, cssName] of Object.entries(MAP_ROLE_CSS_NAMES) as [keyof MapRole, string][]) {
    const value = readThemedCssVar(css, `ds-map-${cssName}`);
    map.light[role] = value.light;
    map.dark[role] = value.dark;
  }
  const shadows = { light: {} as ShadowRole, dark: {} as ShadowRole };
  for (const level of ['sheet', 'lift', 'float'] as const) {
    const name = `ds-shadow-${level}`;
    const value = readThemedCssVar(css, name);
    shadows.light[level] = parseShadow(name, value.light);
    shadows.dark[level] = parseShadow(name, value.dark);
  }
  return { map, shadows };
}

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
  const lightAccentGraphic = ensureContrast(
    copperPin,
    archivePaper,
    MIN_GRAPHIC_CONTRAST,
    blackInk,
  );

  // Surface steps and tertiary ink are the web's own values (packages/ui/src/tokens/colors.ts
  // lightTheme / darkTheme, which mirror tokens.css): canvas and the raised plate sit one value
  // step either side of the Archive Paper swatch, so they are literals rather than swatches.
  const light: ThemeRole = {
    canvas: '#F8F4EC',
    surface,
    surfaceRaised: '#FFFDF8',
    surfacePressed: archivePaper,
    surfaceSunken: '#EDE7DA',
    ink: blackInk,
    inkMuted: stone,
    inkSubtle: stone,
    border: rule,
    borderControl: '#878073',
    borderStrong: blackInk,
    focusRing: blackInk,
    focusRingOffset: '#F8F4EC',
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

  const darkInkMuted = '#BDB5A9';

  const dark: ThemeRole = {
    canvas: '#131110',
    surface: '#1B1917',
    surfaceRaised: '#232019',
    surfacePressed: '#0C0B0A',
    surfaceSunken: '#0C0B0A',
    ink: archivePaper,
    inkMuted: darkInkMuted,
    inkSubtle: darkInkMuted,
    border: '#2C2823',
    borderControl: '#746E65',
    borderStrong: archivePaper,
    focusRing: archivePaper,
    focusRingOffset: '#131110',
    inverse: archivePaper,
    inverseInk: blackInk,
    overlay: 'rgba(0, 0, 0, 0.72)',
    accent: darkAccent,
    accentGraphic: copperTextDark,
    accentMuted: pageSand,
  };

  // Status/confidence hues verbatim from packages/ui/src/tokens/colors.ts
  // (see docblock above for why these are not brand-swatch-derived). Confidence runs
  // green -> olive -> orange, as on web since 6fbfcaf2 reconciled colors.ts with tokens.css.
  const status = {
    light: {
      warning: { fg: '#6B4A17', bg: '#F3E4C6', border: '#AD7226', cue: 'Warning' },
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
      high: { fg: '#2F6B3C', bg: '#DCEBDD', border: '#3E8B54', cue: 'High confidence' },
      medium: { fg: '#6B6A17', bg: '#EBEBC6', border: '#83822A', cue: 'Medium confidence' },
      low: { fg: '#8E4F2A', bg: '#F3E4C6', border: '#B86B2A', cue: 'Low confidence' },
    },
    dark: {
      high: { fg: '#A9D9B4', bg: '#12301C', border: '#5CAD73', cue: 'High confidence' },
      medium: { fg: '#D4D48E', bg: '#2A2A0E', border: '#C4C04A', cue: 'Medium confidence' },
      low: { fg: '#D98540', bg: '#3A2A0E', border: '#B86B2A', cue: 'Low confidence' },
    },
  };

  const tokens: BrandTokens = {
    core: colors,
    typography,
    themes: { light, dark },
    status,
    confidence,
    ...loadWebTokens(),
  };
  assertAccessible(tokens);
  return tokens;
}

/** Fails generation outright if a critical text/UI pair does not clear WCAG AA. */
function assertAccessible(tokens: BrandTokens): void {
  for (const [name, theme] of Object.entries(tokens.themes) as ['light' | 'dark', ThemeRole][]) {
    const textPairs: [string, string, string][] = [
      ['ink/canvas', theme.ink, theme.canvas],
      ['ink/surface', theme.ink, theme.surface],
      ['ink/surfaceRaised', theme.ink, theme.surfaceRaised],
      ['inkMuted/canvas', theme.inkMuted, theme.canvas],
      ['inkSubtle/canvas', theme.inkSubtle, theme.canvas],
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
      ['borderControl/canvas', theme.borderControl, theme.canvas],
      ['borderControl/surfaceRaised', theme.borderControl, theme.surfaceRaised],
      ['borderControl/surfaceSunken', theme.borderControl, theme.surfaceSunken],
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
