/**
 * One definition of "compact" for the whole map surface.
 *
 * Compact means one instrument at a time, as a sheet, with a dock to switch between them. Width
 * alone used to decide it (`< 820px`), so a phone turned sideways (844×390) got the desktop layout:
 * Filters, Records, the timeline and the Door pill all stacked over a 390px-tall map. Height now
 * counts too. Every JS consumer imports this, and the CSS mirrors it as
 * `@media (max-width: 819px), (max-height: 559px)`.
 */
export const COMPACT_MAX_WIDTH = 819;
export const COMPACT_MAX_HEIGHT = 559;

/** Between compact and this width, the two side panels cannot both be open over a useful map. */
export const SINGLE_SIDE_PANEL_MAX_WIDTH = 1149;

export const COMPACT_MEDIA_QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px), (max-height: ${COMPACT_MAX_HEIGHT}px)`;
export const SINGLE_SIDE_PANEL_MEDIA_QUERY = `(max-width: ${SINGLE_SIDE_PANEL_MAX_WIDTH}px)`;

export function isCompactViewport(width: number, height: number): boolean {
  return width <= COMPACT_MAX_WIDTH || height <= COMPACT_MAX_HEIGHT;
}
