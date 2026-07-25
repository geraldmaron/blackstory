/**
 * Pure predicate for the memorial full-list contrast boost: true once the
 * list panel's top edge has crossed into the upper half of the viewport
 * (list "reached/mostly in view"), false otherwise (including when scrolled
 * back above it). Kept separate from the DOM/scroll wiring in
 * MemorialListContrastZone.tsx so the rule itself is deterministically
 * testable without a browser.
 */
export function shouldBoostListContrast(panelTop: number, viewportHeight: number): boolean {
  if (viewportHeight <= 0) {
    return false;
  }
  return panelTop <= viewportHeight * 0.5;
}
