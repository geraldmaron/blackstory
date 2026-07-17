/**
 * Small presentation-only string helpers for the BB-053 evidence interface, kept local to this
 * module tree rather than importing `components/entity/format.ts` (owned by a different bead's
 * exclusive-path scope) — this file's own `humanizeToken` is a one-line duplicate of that same
 * general-purpose helper, not a divergent implementation.
 */

/** `"reputable_secondary"` -> `"Reputable Secondary"`. Used for BB-016 source classifications,
 * BB-053 revision-change kinds, and research-coverage levels — none of which ship a human label
 * of their own on the wire. */
export function humanizeToken(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** `"2026-06-01T00:00:00.000Z"` -> `"2026-06-01"`. Falls back to the raw string for any value
 * that is not an ISO-8601 date-time (e.g. an already-short date, or a free-text placeholder). */
export function formatIsoDate(value: string): string {
  const [datePart] = value.split('T');
  return datePart && datePart.length > 0 ? datePart : value;
}
