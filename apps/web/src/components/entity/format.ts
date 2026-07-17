/**
 * Small presentation-only string helpers shared by the entity-page components in this directory.
 */

/** `"in_force"` -> `"In Force"`. Used for status values and relationship types,
 * neither of which ships a human label of its own in the public projection. */
export function humanizeToken(value: string): string {
  return value
    .split('_')
    .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}
