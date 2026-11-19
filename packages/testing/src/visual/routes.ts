/**
 * Routes covered by the visual baseline and the rendered-page rules.
 * Keep this list small and stable: every entry costs 6 screenshots (3 viewports x 2 themes).
 * Public, data-light pages only; map-first surfaces (`/`, `/explore`) are WebGL and masked.
 */
export const VISUAL_ROUTES = [
  { path: '/', name: 'door', maskMap: true },
  { path: '/explore', name: 'explore', maskMap: true },
  { path: '/records', name: 'records' },
  { path: '/stories', name: 'stories' },
  { path: '/about', name: 'about' },
  { path: '/law', name: 'law' },
  { path: '/methodology', name: 'methodology' },
  { path: '/faq', name: 'faq' },
  { path: '/data', name: 'data' },
  { path: '/memorial', name: 'memorial' },
] as const;

export type VisualRoute = (typeof VISUAL_ROUTES)[number];

/**
 * Checked by the rendered-page rules only, never screenshotted: a chapter carries remote archive
 * images, so its pixels are not stable, but its layout rules are.
 */
export const RULE_ONLY_ROUTES = [{ path: '/stories/the-count', name: 'chapter' }] as const;

export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const;

export const THEMES = ['dark', 'light'] as const;

/** Minimum interactive target, CSS px (WCAG 2.5.5 / platform guidance). */
export const MIN_TARGET_PX = 44;
