/**
 * The Tamagui config for the BlackStory design system. Built only from ./tokens (which are generated
 * from the shipped CSS), so web and, later, native render the same palette, scale and type.
 *
 * Themes carry the design-system color ROLES (canvas, surface, ink, inkMuted, accent, warningFg, ...),
 * named exactly like the CSS custom properties (`--ds-ink-muted` is `$inkMuted`). Components use roles
 * and never a literal; the three Tamagui-default keys (`background`, `color`, `borderColor`) are aliases
 * so Tamagui's own Text and Stack defaults pick up the right values.
 */
import { defaultConfig } from '@tamagui/config/v5';
import { createFont, createTamagui } from '@tamagui/core';
import brand from '../../../../brand/tokens/colors.json';
import {
  TOUCH_TARGET,
  breakpoints,
  leading,
  radius,
  resolveFontFamily,
  space,
  text,
  themes,
  tracking,
  fonts as fontFamilies,
  type TextStep,
} from './tokens';

type ThemeValues = Record<string, string>;

function themeWithAliases(colors: Record<string, string>): ThemeValues {
  return {
    ...colors,
    background: colors.canvas ?? '',
    color: colors.ink ?? '',
    borderColor: colors.border ?? '',
    placeholderColor: colors.inkSubtle ?? '',
  };
}

const STEPS = Object.keys(text) as TextStep[];
const LEADING_BY_STEP = (step: string): number => {
  if (step.startsWith('display')) return leading.display;
  if (step === 'title' || step === 'subtitle') return leading.title;
  if (step.startsWith('editorial')) return leading.editorial;
  return leading.body;
};
const TRACKING_BY_STEP = (step: string): string => {
  if (step.startsWith('display')) return tracking.display;
  if (step === 'title' || step === 'subtitle') return tracking.title;
  if (step === 'caption' || step === 'micro') return tracking.caption;
  return tracking.body;
};

function fontFor(family: string, options: { mono?: boolean } = {}) {
  const size: Record<string, number> = {};
  const lineHeight: Record<string, number> = {};
  const letterSpacing: Record<string, number> = {};
  const weight: Record<string, string> = {};
  for (const step of STEPS) {
    const px = text[step].px ?? 16;
    size[step] = px;
    lineHeight[step] = Math.round(px * LEADING_BY_STEP(step));
    const em = Number.parseFloat(options.mono ? tracking.mono : TRACKING_BY_STEP(step));
    letterSpacing[step] = Math.round(em * px * 100) / 100;
    weight[step] = '400';
  }
  return createFont({
    family: resolveFontFamily(family),
    size,
    lineHeight,
    letterSpacing,
    weight: { ...weight, regular: '400', medium: '500', semibold: '600', bold: '700' },
  });
}

const size = { ...space, touch: TOUCH_TARGET };

export const config = createTamagui({
  ...defaultConfig,
  fonts: {
    // Tamagui's own components read `body` and `heading`; the design system names four registers.
    body: fontFor(fontFamilies.sans),
    heading: fontFor(fontFamilies.display),
    editorial: fontFor(fontFamilies.editorial),
    mono: fontFor(fontFamilies.mono, { mono: true }),
  },
  themes: {
    light: themeWithAliases(themes.light),
    dark: themeWithAliases(themes.dark),
  },
  tokens: {
    ...defaultConfig.tokens,
    space,
    size,
    radius,
    // Raw brand swatches, for logo and map graphics only. UI uses theme roles.
    color: Object.fromEntries(
      Object.entries(brand).map(([key, value]) => [
        `brand${key[0]?.toUpperCase()}${key.slice(1)}`,
        value,
      ]),
    ),
  },
  media: {
    maxSm: { maxWidth: breakpoints.sm - 1 },
    maxMd: { maxWidth: breakpoints.md - 1 },
    maxLg: { maxWidth: breakpoints.lg - 1 },
    maxXl: { maxWidth: breakpoints.xl - 1 },
    gtSm: { minWidth: breakpoints.sm },
    gtMd: { minWidth: breakpoints.md },
    gtLg: { minWidth: breakpoints.lg },
    gtXl: { minWidth: breakpoints.xl },
    hoverable: { hover: 'hover' },
    touch: { pointer: 'coarse' },
    reducedMotion: { prefersReducedMotion: true } as never,
  },
});

export type DesignConfig = typeof config;
