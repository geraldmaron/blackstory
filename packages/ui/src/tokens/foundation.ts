
/**
 * Elevation, border, focus, icon, motion, and data-visualization tokens.
 */

/**
 * Flat system: no shadows hairline borders (Rule) carry separation.
 * The object shape is kept for call-site stability; every value is 'none'.
 */
export const elevation = {
  none: 'none',
  sm: 'none',
  md: 'none',
  lg: 'none',
  darkSm: 'none',
  darkMd: 'none',
  darkLg: 'none',
} as const;

export const borders = {
  widthHairline: '1px',
  widthDefault: '1px',
  widthStrong: '2px',
  radiusNone: '0',
  radiusSm: '8px',
  radiusMd: '16px',
  radiusLg: '28px',
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
  durationFast: '160ms',
  durationBase: '280ms',
  durationSlow: '480ms',
  easingStandard: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easingEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
  reducedMotionQuery: '(prefers-reduced-motion: reduce)',
} as const;


/**
 * Restrained categorical/sequential colors for charts pigment-anchored
 * (Black Ink Copper Pin Page Sand), not neon, not pure grayscale.
 */
export const dataViz = {
  categorical: ['#0A0A0A', '#B86B2A', '#5C5548', '#D8A178', '#7A4318', '#2B2620'] as const,
  sequential: ['#EFE2D0', '#D8A178', '#B86B2A', '#8A4E1C', '#4A2E13', '#0A0A0A'] as const,
  emphasis: '#B86B2A',
  muted: '#A69884',
  gridLine: '#D7D0C4',
  gridLineDark: '#34302C',
} as const;
