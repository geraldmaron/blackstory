/**
 * Shared MapLibre mount helpers for cross-browser WebGL reliability (Safari, Chrome,
 * Firefox desktop; mobile WebKit). Covers zero-size containers, viewport/orientation
 * changes, tab visibility restores, and WebGL context loss.
 */

export function containerHasLayout(container: HTMLElement): boolean {
  const rect = container.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/** Wait until flex/grid parents assign a non-zero box (Safari mini-map blank frames). */
export function waitForContainerLayout(container: HTMLElement): Promise<void> {
  if (containerHasLayout(container)) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new ResizeObserver(() => {
      if (!containerHasLayout(container)) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(container);
    requestAnimationFrame(() => {
      if (!containerHasLayout(container)) return;
      observer.disconnect();
      resolve();
    });
  });
}

/** Fail fast before MapLibre construction when WebGL is unavailable or blocked. */
export function isWebGlAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

export type MapResizeLifecycle = {
  readonly disconnect: () => void;
};

/** The slice of a MapLibre map {@link resizeMapInPlace} touches. */
export type ResizableMap = {
  getContainer(): HTMLElement;
  getCanvas(): HTMLCanvasElement;
  getPixelRatio(): number;
  resize(): unknown;
  redraw(): unknown;
};

/**
 * Re-measure the map against its container WITHOUT a blank frame. Returns whether it resized.
 *
 * `map.resize()` reassigns `canvas.width`, and any assignment, even of the same value, wipes the
 * WebGL drawing buffer. MapLibre then repaints on its NEXT animation frame, so a resize called from
 * a rAF, a scroll or a resize handler leaves one composited frame with an empty canvas, and the
 * plate's own background flashes through the map. Measured on the Door at 375px: one phone
 * toolbar collapse cost two such blank frames. MapLibre's own container observer pairs `resize()`
 * with a synchronous `redraw()` for exactly this reason; every resize the app asks for does too.
 *
 * It also skips when the canvas already matches the container (the same `clientWidth`/
 * `clientHeight` MapLibre measures, at the current pixel ratio). The app has several resize
 * triggers that fire for one layout change, and a redundant one is a full buffer reallocation and
 * a synchronous render for nothing.
 */
export function resizeMapInPlace(map: ResizableMap): boolean {
  const container = map.getContainer();
  const canvas = map.getCanvas();
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (
    canvas.style.width === `${width}px` &&
    canvas.style.height === `${height}px` &&
    canvas.width === Math.floor(map.getPixelRatio() * width) &&
    canvas.height === Math.floor(map.getPixelRatio() * height)
  ) {
    return false;
  }
  map.resize();
  map.redraw();
  return true;
}

/**
 * Keeps MapLibre canvas dimensions in sync after layout, rotation, and tab focus
 * returns. Call `disconnect` on unmount.
 */
export function bindMapResizeLifecycle(
  container: HTMLElement,
  onResize: () => void,
): MapResizeLifecycle {
  const scheduleResize = (): void => {
    requestAnimationFrame(onResize);
  };

  const resizeObserver = new ResizeObserver(scheduleResize);
  resizeObserver.observe(container);

  const handleOrientationChange = (): void => {
    scheduleResize();
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') scheduleResize();
  };

  window.addEventListener('orientationchange', handleOrientationChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return {
    disconnect: () => {
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', handleOrientationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}

export type WebGlContextRecovery = {
  readonly disconnect: () => void;
};

/** MapLibre exposes its GL canvas on the map container after construction. */
export function bindWebGlContextRecovery(
  canvas: HTMLCanvasElement,
  onContextLost: () => void,
  onContextRestored?: () => void,
): WebGlContextRecovery {
  const handleLost = (event: Event): void => {
    event.preventDefault();
    onContextLost();
  };

  const handleRestored = (): void => {
    onContextRestored?.();
  };

  canvas.addEventListener('webglcontextlost', handleLost);
  canvas.addEventListener('webglcontextrestored', handleRestored);

  return {
    disconnect: () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    },
  };
}
