/**
 * Elevation, border, focus, icon, motion, and data-visualization tokens.
 */

export const elevation = {
  none: 'none',
  sm: '0 1px 2px rgba(24, 24, 27, 0.06)',
  md: '0 4px 12px rgba(24, 24, 27, 0.08)',
  lg: '0 12px 28px rgba(24, 24, 27, 0.12)',
  darkSm: '0 1px 2px rgba(0, 0, 0, 0.45)',
  darkMd: '0 4px 14px rgba(0, 0, 0, 0.5)',
  darkLg: '0 14px 32px rgba(0, 0, 0, 0.55)',
} as const;

export const borders = {
  widthHairline: '1px',
  widthDefault: '1px',
  widthStrong: '2px',
  radiusNone: '0',
  radiusSm: '0.25rem',
  radiusMd: '0.375rem',
  radiusLg: '0.5rem',
} as const;

export const focus = {
  outlineWidth: '2px',
  outlineOffset: '2px',
  outlineStyle: 'solid',
} as const;

export const icons = {
  sizeSm: '1rem',
  sizeMd: '1.25rem',
  sizeLg: '1.5rem',
  strokeWidth: '1.75',
} as const;

export const motion = {
  durationInstant: '0ms',
  durationFast: '150ms',
  durationBase: '220ms',
  durationSlow: '360ms',
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  easingEmphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  reducedMotionQuery: '(prefers-reduced-motion: reduce)',
} as const;

/**
 * Restrained categorical/sequential colors for charts — pigment-anchored
 * (Black Ink / Copper Pin / Page Sand), not neon, not pure grayscale.
 */
export const dataViz = {
  categorical: ['#0A0A0A', '#B86B2A', '#5C5548', '#D8A178', '#7A4318', '#2B2620'] as const,
  sequential: ['#EFE2D0', '#D8A178', '#B86B2A', '#8A4E1C', '#4A2E13', '#0A0A0A'] as const,
  emphasis: '#B86B2A',
  muted: '#A69884',
  gridLine: '#E3DCCB',
  gridLineDark: '#2E2A22',
} as const;
