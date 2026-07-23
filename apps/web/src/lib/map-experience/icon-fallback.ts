/**
 * Defensive Font Awesome icon resolution: never pass an undefined glyph to
 * FontAwesomeIcon (fail-closed to a neutral circle mark).
 */
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCircle } from '@fortawesome/free-solid-svg-icons';

export function iconWithFallback(
  icon: IconDefinition | null | undefined,
  fallback: IconDefinition = faCircle,
): IconDefinition {
  return icon ?? fallback;
}
