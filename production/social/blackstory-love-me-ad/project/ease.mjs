// Easing curves. Every shot's movement is authored with one of these; nothing
// relies on a library's default timing.
export const linear = (t) => t;
export const inQuad = (t) => t * t;
export const outQuad = (t) => 1 - (1 - t) ** 2;
export const inOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const inCubic = (t) => t ** 3;
export const outCubic = (t) => 1 - (1 - t) ** 3;
export const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const outQuart = (t) => 1 - (1 - t) ** 4;
export const inOutQuart = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2);
export const outExpo = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
export const inExpo = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10));
export const inOutExpo = (t) =>
  t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
export const outSine = (t) => Math.sin((t * Math.PI) / 2);
export const inOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export const lerp = (a, b, t) => a + (b - a) * t;
// Zoom is logarithmic: interpolating zoom levels linearly gives an even *visual*
// rate of scale change, which is what a camera move should feel like.
export const lerpZoom = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
