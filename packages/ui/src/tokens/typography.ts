/**
 * Typography scale: Sora display/headlines, Inter UI/body, Source Serif 4
 * editorial/longform, IBM Plex Mono for data/citations. Source: owner-supplied
 * brand package (2026-07-17) site type system.
 */

export const fontFamilies = {
  display: '"Sora", "Segoe UI", system-ui, sans-serif',
  editorial: '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
  mono: '"IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

export const typeScale = {
  display: {
    fontSize: 'clamp(2rem, 1.6rem + 2vw, 2.75rem)',
    lineHeight: '1.1',
    fontWeight: '600',
    letterSpacing: '-0.01em',
    family: 'display',
  },
  title: {
    fontSize: 'clamp(1.5rem, 1.35rem + 0.75vw, 1.875rem)',
    lineHeight: '1.2',
    fontWeight: '600',
    letterSpacing: '-0.01em',
    family: 'display',
  },
  heading: {
    fontSize: '1.25rem',
    lineHeight: '1.3',
    fontWeight: '600',
    letterSpacing: '-0.005em',
    family: 'display',
  },
  body: {
    fontSize: '1.0625rem',
    lineHeight: '1.6',
    fontWeight: '400',
    letterSpacing: '0',
    family: 'editorial',
  },
  bodySans: {
    fontSize: '1rem',
    lineHeight: '1.55',
    fontWeight: '400',
    letterSpacing: '0',
    family: 'sans',
  },
  label: {
    fontSize: '0.875rem',
    lineHeight: '1.4',
    fontWeight: '600',
    letterSpacing: '0.02em',
    family: 'sans',
  },
  caption: {
    fontSize: '0.8125rem',
    lineHeight: '1.45',
    fontWeight: '400',
    letterSpacing: '0.01em',
    family: 'sans',
  },
  mono: {
    fontSize: '0.8125rem',
    lineHeight: '1.5',
    fontWeight: '400',
    letterSpacing: '0',
    family: 'mono',
  },
} as const;

export type TypeScaleKey = keyof typeof typeScale;
