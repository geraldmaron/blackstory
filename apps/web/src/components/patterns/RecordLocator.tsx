/**
 * The record's place, as a locator inset rather than a map.
 *
 * WHAT THIS REPLACED AND WHY. The WHERE block used to borrow the site's one persistent MapLibre
 * plate through a `MapMoment`. Three things were wrong with that, and only the third is a bug in
 * the ordinary sense:
 *
 *  1. The plate is `position: fixed` and is moved onto the slot's rect inside a rAF callback, so
 *     it can never be locked to an in-flow box while the page scrolls — the browser scrolls on the
 *     compositor and the JS write lands a frame later. In a full-width 16:9 reading moment that
 *     lag is invisible. In a 240px rail tile it reads as the map sliding around inside its frame.
 *     No amount of tuning fixes it; it is what borrowing a fixed element costs.
 *  2. Ownership is by scroll proximity: `pickLiveMoment` hands the plate to whichever slot is more
 *     than 55% on screen. A small tile in a long rail crosses that line constantly, so the map
 *     appeared, vanished back to idle text, and reappeared as the reader scrolled past its own
 *     record. Content that flickers is not content.
 *  3. The moment's chrome — the PLATE · LIVE tag, MapLibre's attribution, the Atlas hand-off pill —
 *     is sized for a figure several hundred pixels wide. At rail width they overlapped each other
 *     and covered the map they were annotating.
 *
 * Underneath all three is a question of instrument. The block answers "roughly where in the country
 * is this", and the caveat printed directly beneath it says the answer is held to city precision
 * and that exact addresses are never rendered. A live tile-streaming camera is a heavyweight,
 * network-dependent answer that also *implies* a sharpness the record disclaims. A locator states
 * what the archive can actually support, costs no GL context, and — being an ordinary block in the
 * document — cannot tear, blink, or lose a race with the scroll position.
 *
 * Street-level detail did not disappear with it: `Open in maps` and `View on the map` are still
 * right there, and both of them work regardless of WebGL, posture, or which surface this is on.
 *
 * The ground is `public/geo/us-locator.svg` applied as a CSS mask, so it is fetched once for the
 * whole archive, costs the JS bundle nothing, and still takes its colour from a theme token.
 */
import React from 'react';
import { locatorPinPercent } from '../../lib/map-experience/albers-usa';

void React;

export type RecordLocatorProps = {
  readonly lat: number;
  readonly lng: number;
  /** Named in the accessible label, because the graphic itself carries no text. */
  readonly label: string;
  /**
   * When set, this is the accessible name. Empty means silent.
   * The default sentence is for record anatomy, not the first-paint door.
   */
  readonly accessibleName?: string;
  readonly className?: string;
};

/**
 * Returns `null` for a coordinate outside the projection, which is a real answer rather than a
 * failure — the catalog is not promised to be domestic. A record in Liberia renders its place
 * block without a locator instead of being pinned somewhere plausible-looking off Maine.
 */
export function RecordLocator({
  lat,
  lng,
  label,
  accessibleName,
  className,
}: RecordLocatorProps) {
  const pin = locatorPinPercent(lng, lat);
  if (!pin) return null;

  const name =
    accessibleName !== undefined
      ? accessibleName.trim()
      : `Locator map of the United States with ${label} marked.`;

  return (
    <div
      className={className ? `ds-locator ${className}` : 'ds-locator'}
      {...(name.length > 0
        ? { role: 'img', 'aria-label': name }
        : { 'aria-hidden': true })}
    >
      <span className="ds-locator__ground" aria-hidden="true" />
      <span
        className="ds-locator__pin"
        aria-hidden="true"
        style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
      />
    </div>
  );
}
