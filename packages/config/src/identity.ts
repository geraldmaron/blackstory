/**
 * Product and infra identity constants.
 *
 * User-visible product name lives here. Code package scope, CSS prefix, and
 * env prefix are brand-agnostic so a product rename does not require a
 * monorepo rewrite. GCP project ids that cannot change are documented as
 * legacy immutable values.
 */

/** User-facing product name (copy, metadata, JSON-LD). */
export const PRODUCT_NAME = 'BlackStory' as const;

/** Stable npm scope — never rename for product rebrands. */
export const PACKAGE_SCOPE = '@repo' as const;

/** Stable design-system class/token prefix — never rename for product rebrands. */
export const DESIGN_TOKEN_PREFIX = 'ds' as const;

/** Stable application env prefix — never rename for product rebrands. */
export const APP_ENV_PREFIX = 'APP' as const;

/**
 * Production GCP / Firebase project id. Immutable (GCP constraint).
 * Display names and labels may say BlackStory; this id does not change.
 */
export const GCP_PROJECT_ID_PROD = 'black-book-efaaf' as const;

export type BrandTheme = 'light' | 'dark';

/** Role-based public brand asset paths (not product-prefixed filenames). */
export const BRAND_ASSETS = {
  lockup: {
    light: '/brand/lockup-light.png',
    dark: '/brand/lockup-dark.png',
  },
  symbol: {
    light: '/brand/symbol-light.png',
    dark: '/brand/symbol-dark.png',
  },
  openGraph: {
    light: '/brand/open-graph-light-1200x630.png',
    dark: '/brand/open-graph-dark-1200x630.png',
  },
  favicon: {
    light: {
      16: '/brand/favicon-light-16.png',
      32: '/brand/favicon-light-32.png',
      48: '/brand/favicon-light-48.png',
    },
    dark: {
      16: '/brand/favicon-dark-16.png',
      32: '/brand/favicon-dark-32.png',
      48: '/brand/favicon-dark-48.png',
    },
  },
  appleTouchIcon: {
    light: '/brand/apple-touch-icon-light-180.png',
    dark: '/brand/apple-touch-icon-dark-180.png',
  },
} as const;

export function brandLockup(theme: BrandTheme): string {
  return BRAND_ASSETS.lockup[theme];
}

export function brandSymbol(theme: BrandTheme): string {
  return BRAND_ASSETS.symbol[theme];
}

export function brandOpenGraph(theme: BrandTheme): string {
  return BRAND_ASSETS.openGraph[theme];
}

/**
 * Personal maker attribution (not BlackStory product brand). Mark paths follow the
 * same light/dark theme contract as BRAND_ASSETS: light = ink on paper, dark = paper on ink.
 */
export const MAKER = {
  name: 'Gerald Dagher',
  url: 'https://geralddagher.com',
  mark: {
    light: '/maker/gd-mark-light.png',
    dark: '/maker/gd-mark-dark.png',
  },
} as const;

export function makerMark(theme: BrandTheme): string {
  return MAKER.mark[theme];
}
