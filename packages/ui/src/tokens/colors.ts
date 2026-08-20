/**
 * BlackStory color tokens: Archive Paper / Black Ink primary surfaces and ink,
 * Copper Pin Page Sand brand accent, and reserved status hues.
 * Status colors are only for warning, confidence, dispute, and error never decorative chrome.
 * Palette source: brandPalette (brand-palette.ts).
 */

import { brandPalette } from './brand-palette.js';

export const themes = ['light', 'dark'] as const;
export type ThemeName = (typeof themes)[number];

export const statusRoles = ['warning', 'confidence', 'dispute', 'error'] as const;
export type StatusRole = (typeof statusRoles)[number];

export const confidenceLevels = ['high', 'medium', 'low'] as const;
export type ConfidenceLevel = (typeof confidenceLevels)[number];

/** Semantic surface/text/border colors shared by both themes (hex). */
export type ThemePalette = {
  readonly canvas: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly ink: string;
  readonly inkMuted: string;
  readonly inkSubtle: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly focusRing: string;
  readonly focusRingOffset: string;
  readonly inverse: string;
  readonly inverseInk: string;
  readonly overlay: string;
  /** Text/link-safe application of the brand accent (meets 4.5:1 on canvas). */
  readonly accent: string;
  /** Large-scale/graphic-only application of the brand accent (3:1 on canvas; not for body text). */
  readonly accentGraphic: string;
  /** Decorative fill/background tint only never used as a foreground color. */
  readonly accentMuted: string;
};

export type StatusPalette = {
  readonly fg: string;
  readonly bg: string;
  readonly border: string;
  /** Non-color cue glyph/label for screen readers and sighted users. */
  readonly cue: string;
};

export type ConfidencePalette = Record<ConfidenceLevel, StatusPalette>;

export const lightTheme: ThemePalette = {
  canvas: brandPalette.archivePaper,
  surface: brandPalette.surface,
  surfaceRaised: brandPalette.surface,
  ink: brandPalette.blackInk,
  inkMuted: brandPalette.stone,
  inkSubtle: brandPalette.stone,
  border: brandPalette.rule,
  borderStrong: brandPalette.blackInk,
  focusRing: brandPalette.blackInk,
  focusRingOffset: brandPalette.archivePaper,
  inverse: brandPalette.blackInk,
  inverseInk: brandPalette.archivePaper,
  overlay: 'rgba(10, 10, 10, 0.55)',
  accent: brandPalette.copperTextLight,
  accentGraphic: brandPalette.copperPin,
  accentMuted: brandPalette.pageSand,
};

export const darkTheme: ThemePalette = {
  // "Ink" direction: warmer than brandPalette.blackInk/charcoal by design, so these are
  // theme-specific overrides rather than brand swatches — see tokens.css [data-theme='dark'].
  canvas: '#131110',
  surface: '#1B1917',
  surfaceRaised: '#232019',
  ink: brandPalette.archivePaper,
  inkMuted: '#BDB5A9',
  inkSubtle: '#BDB5A9',
  border: '#2C2823',
  borderStrong: brandPalette.archivePaper,
  focusRing: brandPalette.archivePaper,
  focusRingOffset: brandPalette.blackInk,
  inverse: brandPalette.archivePaper,
  inverseInk: brandPalette.blackInk,
  overlay: 'rgba(0, 0, 0, 0.72)',
  accent: brandPalette.copperDark,
  accentGraphic: brandPalette.copperDark,
  accentMuted: brandPalette.pageSand,
};

/**
 * Map plate roles. Consumed by the MapLibre style builders, which emit JSON rather than CSS, so
 * these hexes are the source of truth and `--ds-map-*` in tokens.css mirrors them.
 *
 * The separations between adjacent roles are a contract enforced by `map-contrast.test.ts`:
 * a plate whose land and water sit close together stops reading as a map at continental zoom.
 */
export type MapPalette = {
  readonly land: string;
  readonly water: string;
  /** Parks and wood. Subtle against land by design. */
  readonly green: string;
  /** State boundary. Dashed. */
  readonly line: string;
  /** Country boundary. Solid and heavier than `line`. */
  readonly line2: string;
  readonly road: string;
  /** State labels. */
  readonly label: string;
  /** City and town labels. Carries body-size text, so it is contrast-checked against land. */
  readonly labelHi: string;
  readonly halo: string;
};

export const lightMap: MapPalette = {
  land: '#f6f2e9',
  water: '#c7bdaa',
  green: '#ebe5d1',
  line: '#bdb19a',
  line2: '#a2957c',
  road: '#e6dcc6',
  label: '#6d675f',
  labelHi: '#2e2a24',
  halo: '#f8f5ee',
};

export const darkMap: MapPalette = {
  land: '#38332b',
  water: '#0a0a0c',
  green: '#3e3728',
  line: '#665e4f',
  line2: '#776c5a',
  road: '#474034',
  label: '#9e9587',
  labelHi: '#ded7c9',
  halo: '#16130f',
};

export const mapPalettes = {
  light: lightMap,
  dark: darkMap,
} as const;

export const lightStatus: Record<'warning' | 'dispute' | 'error', StatusPalette> = {
  warning: {
    fg: '#6B4A17',
    bg: '#F3E4C6',
    border: '#B87A2A',
    cue: 'Warning',
  },
  dispute: {
    fg: '#7A1F3D',
    bg: '#F1DCE3',
    border: '#B8395F',
    cue: 'Disputed',
  },
  error: {
    fg: '#7A1F1F',
    bg: '#F3DCD2',
    border: '#B83A2A',
    cue: 'Error',
  },
};

export const darkStatus: Record<'warning' | 'dispute' | 'error', StatusPalette> = {
  warning: {
    fg: '#F0CE8E',
    bg: '#3A2A0E',
    border: '#D6A354',
    cue: 'Warning',
  },
  dispute: {
    fg: '#F0B9C9',
    bg: '#3A1420',
    border: '#D66E8B',
    cue: 'Disputed',
  },
  error: {
    fg: '#F0B3A6',
    bg: '#3A1610',
    border: '#D66B54',
    cue: 'Error',
  },
};

export const lightConfidence: ConfidencePalette = {
  high: {
    fg: '#215A34',
    bg: '#DCEBDD',
    border: '#3E8B54',
    cue: 'High confidence',
  },
  medium: {
    fg: '#6B4A17',
    bg: '#F3E4C6',
    border: '#B87A2A',
    cue: 'Medium confidence',
  },
  low: {
    fg: '#4A453D',
    bg: '#E7E1D3',
    border: '#7A7364',
    cue: 'Low confidence',
  },
};

export const darkConfidence: ConfidencePalette = {
  high: {
    fg: '#A9D9B4',
    bg: '#12301C',
    border: '#5CAD73',
    cue: 'High confidence',
  },
  medium: {
    fg: '#F0CE8E',
    bg: '#3A2A0E',
    border: '#D6A354',
    cue: 'Medium confidence',
  },
  low: {
    fg: '#D4CDBE',
    bg: '#2B2822',
    border: '#8F8672',
    cue: 'Low confidence',
  },
};

export const themePalettes = {
  light: lightTheme,
  dark: darkTheme,
} as const;

export const statusPalettes = {
  light: lightStatus,
  dark: darkStatus,
} as const;

export const confidencePalettes = {
  light: lightConfidence,
  dark: darkConfidence,
} as const;

/** Pairs that must meet WCAG AA for normal text (4.5:1). */
export function criticalTextPairs(
  theme: ThemeName,
): ReadonlyArray<readonly [string, string, string]> {
  const p = themePalettes[theme];
  const status = statusPalettes[theme];
  const confidence = confidencePalettes[theme];
  return [
    ['ink/canvas', p.ink, p.canvas],
    ['ink/surface', p.ink, p.surface],
    ['ink/surfaceRaised', p.ink, p.surfaceRaised],
    ['inkMuted/canvas', p.inkMuted, p.canvas],
    ['inkMuted/surface', p.inkMuted, p.surface],
    ['inkSubtle/canvas', p.inkSubtle, p.canvas],
    ['inverseInk/inverse', p.inverseInk, p.inverse],
    ['accent/canvas', p.accent, p.canvas],
    ['warning', status.warning.fg, status.warning.bg],
    ['dispute', status.dispute.fg, status.dispute.bg],
    ['error', status.error.fg, status.error.bg],
    ['confidence-high', confidence.high.fg, confidence.high.bg],
    ['confidence-medium', confidence.medium.fg, confidence.medium.bg],
    ['confidence-low', confidence.low.fg, confidence.low.bg],
  ];
}

/** UI component focus indicator pairs that must meet 3:1. */
export function criticalUiPairs(
  theme: ThemeName,
): ReadonlyArray<readonly [string, string, string]> {
  const p = themePalettes[theme];
  const status = statusPalettes[theme];
  const confidence = confidencePalettes[theme];
  return [
    ['borderStrong/canvas', p.borderStrong, p.canvas],
    ['focusRing/canvas', p.focusRing, p.canvas],
    ['focusRing/surface', p.focusRing, p.surface],
    ['accentGraphic/canvas', p.accentGraphic, p.canvas],
    ['warning-border/canvas', status.warning.border, p.canvas],
    ['dispute-border/canvas', status.dispute.border, p.canvas],
    ['error-border/canvas', status.error.border, p.canvas],
    ['confidence-high-border/canvas', confidence.high.border, p.canvas],
    ['confidence-medium-border/canvas', confidence.medium.border, p.canvas],
    ['confidence-low-border/canvas', confidence.low.border, p.canvas],
  ];
}
