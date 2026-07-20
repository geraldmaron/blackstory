/**
 * Normalizes user-entered U.S. postal codes for lookup-only flows (explore place search,
 * `/locate` ZIP translate-then-discard). Accepts a 5-digit ZIP or ZIP+4; always returns the
 * 5-digit base for centroid lookup. The raw input is never persisted — see ADR-016.
 */

/** Matches a standalone 5-digit ZIP or ZIP+4 with optional hyphen. */
export const US_ZIP_INPUT_PATTERN = /^(\d{5})(?:-\d{4})?$/;

/**
 * Returns the 5-digit USPS base from a trimmed ZIP or ZIP+4 string, or `undefined` when the
 * input is not a valid standalone postal code.
 */
export function normalizeUsZipInput(raw: string): string | undefined {
  const trimmed = raw.trim();
  const match = US_ZIP_INPUT_PATTERN.exec(trimmed);
  return match?.[1];
}

/** True when the entire trimmed input is only a 5-digit ZIP or ZIP+4. */
export function isUsZipOnlyInput(raw: string): boolean {
  return normalizeUsZipInput(raw) !== undefined;
}
