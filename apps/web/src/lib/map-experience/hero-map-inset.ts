/**
 * Positions the persistent ADR-017 MapStage plate over the home hero map column.
 * Uses fixed viewport geometry (not clip-path) so WebGL paints reliably across Safari,
 * Firefox, and Chrome.
 */

const MAP_STAGE_SELECTOR = '.ds-map-stage';
export const HERO_MAP_INSET_CLASS = 'ds-map-stage--hero-inset';

export type HeroMapStageGeometry = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

function mapStageEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(MAP_STAGE_SELECTOR);
}

/** Viewport-fixed box matching a hero map column rect. */
export function heroMapStageGeometryForRect(rect: DOMRect): HeroMapStageGeometry | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    top: Math.max(0, rect.top),
    left: Math.max(0, rect.left),
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Legacy clip-path helper — kept for regression tests documenting why geometry
 * replaced inset clipping (Safari WebGL + clip-path compositing bugs).
 */
export function insetClipPathForRect(
  rect: DOMRect,
  viewport: { readonly width: number; readonly height: number } = {
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  },
): string {
  const top = Math.max(0, rect.top);
  const left = Math.max(0, rect.left);
  const right = Math.max(0, viewport.width - rect.right);
  const bottom = Math.max(0, viewport.height - rect.bottom);
  return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
}

/** Pin the fixed map plate to the hero map column bounds. Returns false when layout is not ready. */
export function applyHeroMapInset(panel: HTMLElement): boolean {
  const stage = mapStageEl();
  if (!stage) return false;
  const geometry = heroMapStageGeometryForRect(panel.getBoundingClientRect());
  if (!geometry) return false;
  stage.classList.add(HERO_MAP_INSET_CLASS);
  stage.style.removeProperty('clip-path');
  stage.style.top = `${geometry.top}px`;
  stage.style.left = `${geometry.left}px`;
  stage.style.width = `${geometry.width}px`;
  stage.style.height = `${geometry.height}px`;
  stage.style.right = 'auto';
  stage.style.bottom = 'auto';
  return true;
}

/** Restore full-bleed map plate (explore handoff or unmount). */
export function clearHeroMapInset(): void {
  const stage = mapStageEl();
  if (!stage) return;
  stage.classList.remove(HERO_MAP_INSET_CLASS);
  stage.style.removeProperty('clip-path');
  stage.style.removeProperty('top');
  stage.style.removeProperty('left');
  stage.style.removeProperty('width');
  stage.style.removeProperty('height');
  stage.style.removeProperty('right');
  stage.style.removeProperty('bottom');
}
