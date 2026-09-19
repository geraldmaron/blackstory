/**
 * The second line of the Door's "Here" note: where the spotlight record is, without repeating it.
 *
 * A record's place label is often built from its own name ("Townsend School, Winchester,
 * Tennessee"), and some records carry only the name. Printed under the name, either reads as a
 * glitch. So the line is the label with the name taken off the front, or nothing at all when the
 * label adds no locality.
 */
export function hereLocality(name: string, place: string): string | null {
  const trimmedName = name.trim();
  const trimmedPlace = place.trim();
  if (trimmedPlace.length === 0) return null;

  const lowerName = trimmedName.toLowerCase();
  const lowerPlace = trimmedPlace.toLowerCase();
  if (lowerPlace === lowerName) return null;

  // Only a whole leading name comes off, one that ends at a comma. "National Baseball Hall of
  // Fame" must not strip "National Baseball Hall of Fame and Museum, Cooperstown" down to
  // "and Museum, Cooperstown".
  if (lowerName.length > 0 && lowerPlace.startsWith(lowerName)) {
    const after = trimmedPlace.slice(trimmedName.length);
    if (/^\s*,/.test(after)) {
      const rest = after.replace(/^[\s,]+/, '').trim();
      return rest.length > 0 ? rest : null;
    }
  }

  return trimmedPlace;
}
