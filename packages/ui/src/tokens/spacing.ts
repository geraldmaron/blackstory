
/**
 * Spacing and layout grid tokens on a 4px base rhythm.
 */

export const space = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

export const grid = {
  columns: 12,
  gutter: space[4],
  gutterLg: space[6],
  maxWidth: '72rem',
  contentWidth: '42rem',
  breakpoints: {
    sm: '40rem',
    md: '48rem',
    lg: '64rem',
    xl: '80rem',
  },
} as const;

export type SpaceKey = keyof typeof space;
