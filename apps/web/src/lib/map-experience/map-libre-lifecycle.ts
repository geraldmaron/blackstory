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
