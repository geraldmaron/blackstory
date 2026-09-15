/**
 * In-place map browse morph on the Door journey.
 *
 * The Door listens for enter/exit. CommandBar and CTAs dispatch enter instead of hard-routing
 * to `/explore` when the journey surface is mounted. Cold loads and deep links of `/explore`
 * render the same Door already armed (initialBrowse) — one shell, not a second cockpit.
 */

export const MAP_BROWSE_ENTER_EVENT = 'blackstory:map-browse-enter';
export const MAP_BROWSE_EXIT_EVENT = 'blackstory:map-browse-exit';
export const MAP_BROWSE_ENTERED_EVENT = 'blackstory:map-browse-entered';
export const MAP_BROWSE_EXITED_EVENT = 'blackstory:map-browse-exited';

/** Ask the Door to morph into browse. Falls back to `/explore` when the Door is not mounted. */
export function enterMapBrowse(href = '/explore'): void {
  if (typeof window === 'undefined') return;
  const door = document.querySelector('.ds-door');
  if (door) {
    window.dispatchEvent(new CustomEvent(MAP_BROWSE_ENTER_EVENT));
    return;
  }
  window.location.assign(href);
}

/** Ask the Door to leave browse and restore the journey. No-op off the Door. */
export function exitMapBrowse(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MAP_BROWSE_EXIT_EVENT));
}

export function announceMapBrowseEntered(): void {
  if (typeof window === 'undefined') return;
  document.documentElement.dataset.doorBrowse = '1';
  window.dispatchEvent(new CustomEvent(MAP_BROWSE_ENTERED_EVENT));
}

export function announceMapBrowseExited(): void {
  if (typeof window === 'undefined') return;
  delete document.documentElement.dataset.doorBrowse;
  window.dispatchEvent(new CustomEvent(MAP_BROWSE_EXITED_EVENT));
}
