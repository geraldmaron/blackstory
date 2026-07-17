/**
 * Black Book color tokens: black/white/neutral primary palette plus reserved status hues.
 * Status colors are only for warning, confidence, dispute, and error — never decorative chrome.
 */

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
  canvas: '#F4F4F5',
  surface: '#FAFAFA',
  surfaceRaised: '#FFFFFF',
  ink: '#18181B',
  inkMuted: '#3F3F46',
  inkSubtle: '#52525B',
  border: '#D4D4D8',
  borderStrong: '#71717A',
  focusRing: '#18181B',
  focusRingOffset: '#FFFFFF',
  inverse: '#18181B',
  inverseInk: '#FAFAFA',
  overlay: 'rgba(24, 24, 27, 0.55)',
};

export const darkTheme: ThemePalette = {
  canvas: '#09090B',
  surface: '#18181B',
  surfaceRaised: '#27272A',
  ink: '#FAFAFA',
  inkMuted: '#D4D4D8',
  inkSubtle: '#A1A1AA',
  border: '#3F3F46',
  borderStrong: '#71717A',
  focusRing: '#FAFAFA',
  focusRingOffset: '#09090B',
  inverse: '#FAFAFA',
  inverseInk: '#18181B',
  overlay: 'rgba(9, 9, 11, 0.72)',
};

export const lightStatus: Record<'warning' | 'dispute' | 'error', StatusPalette> = {
  warning: {
    fg: '#713F12',
    bg: '#FEF3C7',
    border: '#D97706',
    cue: 'Warning',
  },
  dispute: {
    fg: '#9F1239',
    bg: '#FFE4E6',
    border: '#E11D48',
    cue: 'Disputed',
  },
  error: {
    fg: '#991B1B',
    bg: '#FEE2E2',
    border: '#DC2626',
    cue: 'Error',
  },
};

export const darkStatus: Record<'warning' | 'dispute' | 'error', StatusPalette> = {
  warning: {
    fg: '#FDE68A',
    bg: '#422006',
    border: '#F59E0B',
    cue: 'Warning',
  },
  dispute: {
    fg: '#FECDD3',
    bg: '#4C0519',
    border: '#FB7185',
    cue: 'Disputed',
  },
  error: {
    fg: '#FECACA',
    bg: '#450A0A',
    border: '#F87171',
    cue: 'Error',
  },
};

export const lightConfidence: ConfidencePalette = {
  high: {
    fg: '#14532D',
    bg: '#DCFCE7',
    border: '#16A34A',
    cue: 'High confidence',
  },
  medium: {
    fg: '#713F12',
    bg: '#FEF3C7',
    border: '#D97706',
    cue: 'Medium confidence',
  },
  low: {
    fg: '#3F3F46',
    bg: '#E4E4E7',
    border: '#71717A',
    cue: 'Low confidence',
  },
};

export const darkConfidence: ConfidencePalette = {
  high: {
    fg: '#BBF7D0',
    bg: '#052E16',
    border: '#4ADE80',
    cue: 'High confidence',
  },
  medium: {
    fg: '#FDE68A',
    bg: '#422006',
    border: '#FBBF24',
    cue: 'Medium confidence',
  },
  low: {
    fg: '#D4D4D8',
    bg: '#27272A',
    border: '#A1A1AA',
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
    ['warning', status.warning.fg, status.warning.bg],
    ['dispute', status.dispute.fg, status.dispute.bg],
    ['error', status.error.fg, status.error.bg],
    ['confidence-high', confidence.high.fg, confidence.high.bg],
    ['confidence-medium', confidence.medium.fg, confidence.medium.bg],
    ['confidence-low', confidence.low.fg, confidence.low.bg],
  ];
}

/** UI component / focus indicator pairs that must meet 3:1. */
export function criticalUiPairs(
  theme: ThemeName,
): ReadonlyArray<readonly [string, string, string]> {
  const p = themePalettes[theme];
  return [
    ['borderStrong/canvas', p.borderStrong, p.canvas],
    ['focusRing/canvas', p.focusRing, p.canvas],
    ['focusRing/surface', p.focusRing, p.surface],
  ];
}
