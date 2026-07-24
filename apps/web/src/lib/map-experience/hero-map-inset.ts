/**
 * Positions the persistent ADR-017 MapStage plate over the home hero panel.
 * Uses fixed viewport geometry (not clip-path) so WebGL paints reliably across Safari,
 * Firefox, and Chrome. The plate fills the full rounded hero frame so basemap + pins
 * extend under the copy column; copy sits above a light matte scrim.
 */

import { CAMERA_PRESETS } from './camera-presets';

const MAP_STAGE_SELECTOR = '.ds-map-stage';
export const HERO_MAP_INSET_CLASS = 'ds-map-stage--hero-inset';

export type HeroMapStageGeometry = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

export type HeroCameraPadding = {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
};

function mapStageEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(MAP_STAGE_SELECTOR);
}

export type ViewportBounds = {
  readonly width: number;
  readonly height: number;
};

const DEFAULT_VIEWPORT: ViewportBounds = {
  width: typeof window !== 'undefined' ? window.innerWidth : 4096,
  height: typeof window !== 'undefined' ? window.innerHeight : 4096,
};

/** Minimum visible share of the hero panel before the inset hides (avoids orphan slivers). */
export const HERO_MAP_INSET_MIN_VISIBLE_RATIO = 0.2;

/** Matches shell.css `.ds-home-hero` desktop grid (`46fr 54fr`). */
export const HERO_COPY_COLUMN_FR = 46;
export const HERO_MAP_COLUMN_FR = 54;

/** Viewport-fixed box matching the visible hero panel intersection. Returns null when off-screen. */
export function heroMapStageGeometryForRect(
  rect: DOMRect,
  viewport: ViewportBounds = DEFAULT_VIEWPORT,
): HeroMapStageGeometry | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (rect.bottom <= 0 || rect.top >= viewport.height) return null;
  if (rect.right <= 0 || rect.left >= viewport.width) return null;

  const visibleTop = Math.max(0, rect.top);
  const visibleLeft = Math.max(0, rect.left);
  const visibleBottom = Math.min(viewport.height, rect.bottom);
  const visibleRight = Math.min(viewport.width, rect.right);
  const width = visibleRight - visibleLeft;
  const height = visibleBottom - visibleTop;

  if (width <= 0 || height <= 0) return null;

  const visibleRatio = (width * height) / (rect.width * rect.height);
  if (visibleRatio < HERO_MAP_INSET_MIN_VISIBLE_RATIO) return null;

  return {
    top: visibleTop,
    left: visibleLeft,
    width,
    height,
  };
}

/**
 * Asymmetric national padding so CONUS keeps framing in the map readout after the
 * MapStage plate expands to the full hero panel. Left (desktop) or top (mobile stack)
 * padding clears the copy column; other edges keep the national preset clearance.
 *
 * Without this, expanding the container leftward would recenter/shrink the country
 * relative to the prior map-column-only inset (user-visible "shifting").
 */
export function heroNationalCameraPadding(args: {
  readonly panel: Pick<DOMRect, 'width' | 'height' | 'left' | 'top'>;
  readonly copy: Pick<DOMRect, 'width' | 'height' | 'left' | 'top' | 'right' | 'bottom'> | null;
  readonly basePadding?: number;
}): HeroCameraPadding {
  const base = args.basePadding ?? CAMERA_PRESETS.national.padding;
  if (!args.copy || args.panel.width <= 0 || args.panel.height <= 0) {
    return { top: base, right: base, bottom: base, left: base };
  }

  const stacked = args.copy.width >= args.panel.width * 0.9;
  if (stacked) {
    const copyBand = Math.round(args.copy.bottom - args.panel.top);
    // Keep CONUS mostly in the map band; let the upper copy overlap basemap.
    return {
      top: Math.max(base, Math.round(copyBand * 0.35)),
      right: base,
      bottom: base,
      left: base,
    };
  }

  const copyBand = Math.round(args.copy.right - args.panel.left);
  // Modest left pad so western states/pins sit under the headline while CONUS
  // still reads primarily in the map-readout column (not recentered full-bleed).
  return {
    top: base,
    right: base,
    bottom: base,
    left: Math.max(base, Math.round(copyBand * 0.22)),
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

/** Pin the fixed map plate to the hero panel bounds. Returns false when layout is not ready. */
export function applyHeroMapInset(panel: HTMLElement): boolean {
  const stage = mapStageEl();
  if (!stage) return false;
  const geometry = heroMapStageGeometryForRect(panel.getBoundingClientRect());
  if (!geometry) {
    stage.classList.remove(HERO_MAP_INSET_CLASS);
    stage.style.visibility = 'hidden';
    return false;
  }
  stage.classList.add(HERO_MAP_INSET_CLASS);
  stage.style.visibility = 'visible';
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
  stage.style.removeProperty('visibility');
  stage.style.removeProperty('clip-path');
  stage.style.removeProperty('top');
  stage.style.removeProperty('left');
  stage.style.removeProperty('width');
  stage.style.removeProperty('height');
  stage.style.removeProperty('right');
  stage.style.removeProperty('bottom');
}
