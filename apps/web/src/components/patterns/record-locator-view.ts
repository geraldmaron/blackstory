/**
 * Pan and zoom state for the interactive record locator (national SVG inset, not MapLibre).
 * Keeps wheel-zoom anchored to the pointer and clamps scale so the inset stays a locator.
 */

export type LocatorViewState = {
  readonly scale: number;
  readonly panX: number;
  readonly panY: number;
};

export const LOCATOR_MIN_SCALE = 1;
export const LOCATOR_MAX_SCALE = 5;

export function defaultLocatorView(): LocatorViewState {
  return { scale: 1, panX: 0, panY: 0 };
}

function clampScale(scale: number): number {
  return Math.min(LOCATOR_MAX_SCALE, Math.max(LOCATOR_MIN_SCALE, scale));
}

/** Zoom toward a point in container coordinates (pixels from top-left). */
export function zoomLocatorViewAt(
  state: LocatorViewState,
  factor: number,
  anchorX: number,
  anchorY: number,
): LocatorViewState {
  if (!Number.isFinite(factor) || factor <= 0) return state;
  const nextScale = clampScale(state.scale * factor);
  if (nextScale === state.scale) return state;
  const ratio = nextScale / state.scale;
  return {
    scale: nextScale,
    panX: anchorX - (anchorX - state.panX) * ratio,
    panY: anchorY - (anchorY - state.panY) * ratio,
  };
}

export function panLocatorView(
  state: LocatorViewState,
  deltaX: number,
  deltaY: number,
): LocatorViewState {
  if (deltaX === 0 && deltaY === 0) return state;
  return {
    ...state,
    panX: state.panX + deltaX,
    panY: state.panY + deltaY,
  };
}

export function wheelFactorForDelta(deltaY: number): number {
  if (deltaY === 0) return 1;
  const step = Math.min(0.25, Math.abs(deltaY) / 400);
  return deltaY > 0 ? 1 - step : 1 + step;
}

export function locatorCanvasTransform(state: LocatorViewState): string {
  return `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
}
