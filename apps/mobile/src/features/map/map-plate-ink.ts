/**
 * Ink and ghost fills for controls drawn ON the dark archive map plate.
 *
 * WHY THIS LIVES UNDER `features/map/`, NOT `features/explore/`: the plate is a property of the
 * map surface, so anything drawn over it — Explore's floating chrome, the attribution pill, the
 * zoom controls — has to agree on one set of fills. These started in `features/explore/
 * explore-chrome.tsx`, which meant `MapAttribution` (a `features/map/` module, and the wrong
 * direction to import from) could not reach them and reached for `theme.surface` instead. That
 * put one opaque light block among translucent ghosts on a dark plate.
 *
 * The plate stays on the dark register regardless of device theme (ADR-013), so these are token
 * references at fixed alpha — never hand-copied rgba triples that drift from the palette.
 */
import { brandCore, themeColors } from '@/ui/tokens';

/** Small hex → `rgba()` helper so ghost fills read as "brand token at alpha". */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const MAP_INK = brandCore.archivePaper;
export const MAP_INK_MUTED = withAlpha(brandCore.archivePaper, 0.68);
/** Resting fill for any ghost control on the plate. */
export const MAP_GHOST_BG = withAlpha(brandCore.archivePaper, 0.08);
/** Hairline edge that keeps a ghost control legible over both land and water. */
export const MAP_GHOST_BORDER = withAlpha(brandCore.archivePaper, 0.22);
export const MAP_ACCENT = themeColors.dark.accentGraphic;
export const MAP_GHOST_ACTIVE = withAlpha(MAP_ACCENT, 0.28);
/** Pressed feedback fill for ghost controls on the dark plate. */
export const MAP_GHOST_PRESSED = withAlpha(brandCore.archivePaper, 0.14);
