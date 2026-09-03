/**
 * The three postures the persistent map plate can hold, and the rule that resolves one from a
 * route's surface class.
 *
 * Design law: `docs/ui/design-direction-v9-surfaces.md` §3 and `docs/ui/patterns-plate-posture.md`.
 *
 * The plate mounts once, above every route, and never reloads. What changes between routes is
 * only how it is painted:
 *
 *   Live    full viewport, reader-driven pan and zoom, dignity gates active. The map IS the
 *           content, so it is behind nothing.
 *   Framed  inset into a bounded in-flow slot published by a `MapMoment`. Camera moves are
 *           `flyTo` only and gestures are locked, because the slot belongs to the document.
 *   Parked  not painted. No gestures, no animation frames, no resize work.
 *
 * The binding rule the postures exist to enforce is that the plate is never behind body text
 * outside the Instrument. A map behind prose is decoration: it costs a GL context and asserts a
 * connection between the words and the place that nothing verified.
 *
 * Posture is DERIVED from the surface class, never passed in as a prop. `ShellPageTransition`
 * already emits `data-surface` from `surfaceClassFor`, but the plate is a sibling of that wrapper
 * under `<body>` rather than a descendant, so it cannot read the attribute by descent. It calls
 * the same function instead. A second table keyed on the same routes would drift the first time
 * someone added a route to one of them.
 */
import type { SurfaceClass } from '../../lib/nav/surface-classes';

/**
 * How the plate is painted on the current surface.
 *
 * `ambient` is the Door's posture: painted full-viewport like Live, gestures locked like Framed.
 * The scroll chapters drive the camera and the reader's wheel has to keep scrolling the document,
 * so the plate shows the same clustered field the Instrument shows without ever taking the wheel.
 * Clicks still reach it — a cluster drills in, a pin opens its record — because a click is not a
 * gesture.
 */
export type PlatePosture = 'live' | 'ambient' | 'framed' | 'parked';

/**
 * The resolution table, exhaustive over {@link SurfaceClass} by construction.
 *
 * `satisfies` rather than a type annotation is deliberate: it makes a fifth surface class a
 * typecheck failure here rather than a silent fall-through to whatever the default branch of a
 * `switch` happened to be. The plate's posture is the kind of decision that should refuse to
 * compile when it becomes incomplete.
 */
const POSTURE_BY_SURFACE = {
  // The map is the content.
  instrument: 'live',
  // The map is the field the chapters scroll over: painted, never steered by hand.
  door: 'ambient',
  // A record page's place block is a bounded slot, and it is the one Reading-adjacent surface
  // that always has something to frame, so the plate arrives already expecting a claim.
  record: 'framed',
  // A reading room is paper. The plate stays parked until a `MapMoment` scrolls in and claims a
  // slot; between moments, and in rooms with no moment at all, nothing is painted.
  reading: 'parked',
  // Task surfaces finish and are left. A form has no geography.
  utility: 'parked',
} as const satisfies Record<SurfaceClass, PlatePosture>;

/**
 * The posture a surface holds before any slot is claimed.
 *
 * Endpoints (`null` — redirects, feeds, JSON) render no chrome at all, so they park.
 */
export function defaultPostureFor(surface: SurfaceClass | null): PlatePosture {
  if (surface === null) return 'parked';
  return POSTURE_BY_SURFACE[surface];
}

/**
 * Whether a Framed slot claim may be granted on this surface at all.
 *
 * False on Instrument for a reason that is easy to miss: `RecordAnatomyPanel` is shared between
 * the record page and Explore's record sheet, so the same `RecordPlacePreview` that borrows the
 * plate on `/entity/[id]` also renders inside a sheet floating OVER the live plate. A sheet cannot
 * borrow the plate it is floating over. Refusing the claim here is what makes that case fall back
 * to a static block with no extra prop and no caller having to know which surface it is on.
 *
 * False on Utility because a parked plate on a task surface should stay unbuilt, not be woken by
 * a stray moment.
 */
export function framedClaimAllowed(surface: SurfaceClass | null): boolean {
  if (surface === null) return false;
  // The Door's plate is already painted full-bleed; a moment has nothing to borrow it into.
  return surface === 'reading' || surface === 'record';
}
