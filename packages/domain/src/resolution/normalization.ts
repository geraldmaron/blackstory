/**
 * Deterministic alias normalization, fuzzy comparison, and US address parsing.
 */
import type { ParsedAddress } from './types.js';

const ORGANIZATION_SUFFIXES = new Set([
  'association',
  'company',
  'corporation',
  'inc',
  'incorporated',
  'llc',
  'organization',
  'society',
]);

export function normalizeAlias(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeOrganizationName(value: string): string {
  const tokens = normalizeAlias(value).split(' ').filter(Boolean);
  while (tokens.length > 1 && ORGANIZATION_SUFFIXES.has(tokens.at(-1)!)) {
    tokens.pop();
  }
  return tokens.join(' ');
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length]!;
}

export function nameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeAlias(left);
  const normalizedRight = normalizeAlias(right);
  const length = Math.max(normalizedLeft.length, normalizedRight.length);
  if (length === 0) return 1;
  return Math.max(0, 1 - levenshtein(normalizedLeft, normalizedRight) / length);
}

export function parseAddress(raw: string): ParsedAddress {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const finalPart = parts.at(-1) ?? '';
  const stateZip = finalPart.match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  const postalOnly = finalPart.match(/^(\d{5}(?:-\d{4})?)$/);
  const hasState = stateZip !== null;
  const hasPostalOnly = postalOnly !== null;
  const localityEnd = hasState || hasPostalOnly ? parts.length - 1 : parts.length;
  const street = parts.length > 1 ? parts[0] : undefined;
  const city = localityEnd > 1 ? parts[localityEnd - 1] : undefined;
  return {
    raw,
    ...(street ? { street } : {}),
    ...(city ? { city } : {}),
    ...(stateZip?.[1] ? { state: stateZip[1].toUpperCase() } : {}),
    ...(stateZip?.[2]
      ? { postalCode: stateZip[2] }
      : postalOnly?.[1]
        ? { postalCode: postalOnly[1] }
        : {}),
    countryCode: 'US',
  };
}
