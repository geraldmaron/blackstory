/**
 * Framing for the record locator (national SVG inset, not MapLibre): the national view, or a
 * region framed on the pin for a place hero. The locator is a picture; nothing pans or zooms it.
 */

export type LocatorViewState = {
  readonly scale: number;
  readonly panX: number;
  readonly panY: number;
};

export const LOCATOR_MIN_SCALE = 1;
export const LOCATOR_MAX_SCALE = 8;
/** Opening scale for a place hero: a region, not a town lot. Pin size is inverse-scaled in CSS. */
export const LOCATOR_NEIGHBORHOOD_SCALE = 2.15;

export function defaultLocatorView(): LocatorViewState {
  return { scale: 1, panX: 0, panY: 0 };
}

/**
 * Neighborhood-zoom opening view for a place hero: the pin sits near center at a scale that
 * reads as a region, not a national thumbnail. Container size defaults match the mast slot.
 */
export function neighborhoodLocatorView(
  pinPercentX: number,
  pinPercentY: number,
  width = 720,
  height = 420,
  scale = LOCATOR_NEIGHBORHOOD_SCALE,
): LocatorViewState {
  const nextScale = clampScale(scale);
  const pinX = (pinPercentX / 100) * width;
  const pinY = (pinPercentY / 100) * height;
  return {
    scale: nextScale,
    panX: width / 2 - pinX * nextScale,
    panY: height / 2 - pinY * nextScale,
  };
}

function clampScale(scale: number): number {
  return Math.min(LOCATOR_MAX_SCALE, Math.max(LOCATOR_MIN_SCALE, scale));
}

export function locatorCanvasTransform(state: LocatorViewState): string {
  return `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
}
