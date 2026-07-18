
/**
 * Typography scale: Inter Display display/headlines, Inter UI/body, Source
 * Serif 4 editorial/longform, IBM Plex Mono for data/citations. Source:
 * brand pack v3 (brand-system/tokens) fluid type scale, guide p.8.
 */

export const fontFamilies = {
  display: '"Inter Display", "Inter", system-ui, sans-serif',
  editorial: '"Source Serif 4", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  sans: '"Inter", "Segoe UI", system-ui, sans-serif',
  mono: '"IBM Plex Mono", "SFMono-Regular", Menlo, Consolas, monospace',
} as const;

export const typeScale = {
  display: {
    fontSize: 'clamp(3rem, 2.25rem + 3.75vw, 4.5rem)',
    lineHeight: '1.1',
    fontWeight: '650',
    letterSpacing: '-0.035em',
    family: 'display',
  },
  title: {
    fontSize: 'clamp(2.25rem, 1.95rem + 1.5vw, 3rem)',
    lineHeight: '1.2',
    fontWeight: '650',
    letterSpacing: '-0.02em',
    family: 'display',
  },
  heading: {
    fontSize: 'clamp(1.5rem, 1.35rem + 0.9vw, 2rem)',
    lineHeight: '1.3',
    fontWeight: '650',
    letterSpacing: '-0.01em',
    family: 'display',
  },
  body: {
    fontSize: 'clamp(1rem, 0.95rem + 0.3vw, 1.125rem)',
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
