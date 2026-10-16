/**
 * The design tokens, typed. Colors, space, radius, type and motion come from
 * ./generated/tokens.ts, which is generated from the shipped CSS (packages/ui/src/styles/tokens.css);
 * breakpoints come from packages/ui/src/tokens/spacing.ts, the one TS token module that the CSS and the
 * lint ratchet already treat as the grid. Nothing here is a second source of values.
 *
 * Extraction note: src/design has no imports from the rest of apps/site, so it moves to packages/design
 * unchanged when mobile adopts it.
 */
import { grid } from '../../../../packages/ui/src/tokens/spacing';
import {
  border,
  duration,
  fonts,
  focus,
  leading,
  radius,
  space,
  text,
  themes,
  tracking,
} from './generated/tokens';

export { border, duration, focus, fonts, leading, radius, space, text, themes, tracking };

export type ThemeName = keyof typeof themes;
export type ColorRole = keyof (typeof themes)['light'];
export type SpaceStep = keyof typeof space;
export type TextStep = keyof typeof text;

/** WCAG 2.5.5 / platform guidance: the smallest interactive target, in CSS px. */
export const TOUCH_TARGET = 44;

const remPx = (rem: string): number => Number.parseFloat(rem) * 16;

/** The grid breakpoints in px (grid.breakpoints: 40, 48, 64, 80 rem). */
export const breakpoints = {
  sm: remPx(grid.breakpoints.sm),
  md: remPx(grid.breakpoints.md),
  lg: remPx(grid.breakpoints.lg),
  xl: remPx(grid.breakpoints.xl),
} as const;

export type BreakpointName = keyof typeof breakpoints;

/** `var(--ds-font-sans, system-ui, sans-serif)` -> `system-ui, sans-serif`: native and RN Web have no CSS variables. */
export function resolveFontFamily(family: string): string {
  return family.replace(/var\(--[\w-]+,\s*([^)]+)\)/g, '$1');
}
