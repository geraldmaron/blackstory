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

/**
 * Read live, never captured at module load: a window that is 0-sized when this module first
 * evaluates (headless panes, a preview iframe that sizes after hydration) would otherwise
 * freeze a 0x0 viewport for the session, and every hero rect would then read as "off-screen"
 * — the plate hides itself and the hero map never appears until a full reload.
 */
function currentViewport(): ViewportBounds {
  if (typeof window === 'undefined' || window.innerHeight <= 0 || window.innerWidth <= 0) {
    return { width: 4096, height: 4096 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Minimum visible share of the hero panel before the inset hides (avoids orphan slivers). */
export const HERO_MAP_INSET_MIN_VISIBLE_RATIO = 0.2;

/** Matches shell.css `.ds-home-hero` desktop grid (`46fr 54fr`). */
export const HERO_COPY_COLUMN_FR = 46;
export const HERO_MAP_COLUMN_FR = 54;

/**
 * Viewport-fixed box that tracks the FULL hero panel (top may be negative), so the fixed
 * MapStage plate translates up off-screen with the hero as it scrolls past — instead of
 * clamping its top to 0 and shrinking into a clipped band pinned under the sticky nav
 * (repo-3lzc). The hide decision uses the TRUE visible overlap ratio (not the clamped box),
 * so the plate disappears cleanly once the panel is mostly gone rather than leaving a sliver.
 * Returns null when off-screen or below the min-visible ratio.
 */
export function heroMapStageGeometryForRect(
  rect: DOMRect,
  viewport: ViewportBounds = currentViewport(),
): HeroMapStageGeometry | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (rect.bottom <= 0 || rect.top >= viewport.height) return null;
  if (rect.right <= 0 || rect.left >= viewport.width) return null;

  // True intersection with the viewport, used only to decide when to hide.
  const visibleTop = Math.max(0, rect.top);
  const visibleLeft = Math.max(0, rect.left);
  const visibleBottom = Math.min(viewport.height, rect.bottom);
  const visibleRight = Math.min(viewport.width, rect.right);
  const visibleWidth = visibleRight - visibleLeft;
  const visibleHeight = visibleBottom - visibleTop;

  if (visibleWidth <= 0 || visibleHeight <= 0) return null;

  const visibleRatio = (visibleWidth * visibleHeight) / (rect.width * rect.height);
  if (visibleRatio < HERO_MAP_INSET_MIN_VISIBLE_RATIO) return null;

  // Track the full panel box (not the clamped intersection): the plate stays glued to the
  // hero panel and scrolls away with it, keeping the map's natural framing intact.
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
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

/**
 * Pin the fixed map plate to a hero region. Returns false when layout is not ready.
 *
 * `insetTarget` chooses which box the plate tracks: on desktop it is the full hero panel
 * (map bleeds under the copy column — the cinematic treatment). On the mobile stacked
 * layout the caller passes the map-row element instead, so the plate is bounded to the
 * map band beneath the copy and never expands into a full-panel-tall dark plate that
 * trails as a black gap on scroll (repo mobile-hero-black-space).
 */
export function applyHeroMapInset(panel: HTMLElement, insetTarget?: HTMLElement): boolean {
  const stage = mapStageEl();
  if (!stage) return false;
  const geometry = heroMapStageGeometryForRect((insetTarget ?? panel).getBoundingClientRect());
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

/** Class carrying the geometry transition — see `map-surfaces.css`. */
export const HERO_MAP_PLATE_TRANSITION_CLASS = 'ds-map-stage--plate-transition';

/** Must match the transition duration in `map-surfaces.css` (`--ds-duration-slow`, 480ms). */
export const HERO_MAP_PLATE_TRANSITION_MS = 480;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Run a geometry change (`clearHeroMapInset` on engage, `applyHeroMapInset` on close) as an
 * animated box change instead of a snap. Without this the plate cuts from the hero panel to
 * full-bleed in one frame while the content is still fading — the "hard cut" the Engaged
 * transition is supposed to avoid.
 *
 * `onFrame` (the caller's `MapStage.resize()`) runs every frame for the duration: the CSS
 * box animates but the WebGL drawing buffer only changes when MapLibre is told to resize, so
 * a static buffer would visibly stretch across the flight. Reduced motion skips straight to
 * the destination (spec §3 "camera flights become cuts").
 */
export function animateHeroMapPlate(
  applyGeometry: () => void,
  onFrame: () => void,
  onSettled: () => void = () => {},
): void {
  const stage = mapStageEl();
  if (!stage || prefersReducedMotion()) {
    applyGeometry();
    onFrame();
    onSettled();
    return;
  }

  stage.classList.add(HERO_MAP_PLATE_TRANSITION_CLASS);
  applyGeometry();

  let running = true;
  const tick = () => {
    if (!running) return;
    onFrame();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // The end of the transition is a timer, not the rAF loop: rAF is suspended while the tab is
  // hidden, and a reader who tabs away mid-transition would otherwise come back to a plate
  // that never got its final resize or its framing.
  window.setTimeout(() => {
    running = false;
    stage.classList.remove(HERO_MAP_PLATE_TRANSITION_CLASS);
    onFrame();
    // Framing is fitted only once the box has stopped moving: a fit computed against the
    // mid-flight box lands off-centre by however much the box still had left to grow.
    onSettled();
  }, HERO_MAP_PLATE_TRANSITION_MS);
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
