/**
 * Predefined flat geometric atmosphere planes for story and entity masts.
 * Flat matte fills only — brand colors, no gradients or photographic content.
 */
export const GEOMETRIC_FALLBACK_IDS = ['rules', 'ledger', 'pins', 'tessellation'] as const;

export type GeometricFallbackId = (typeof GEOMETRIC_FALLBACK_IDS)[number];

export type GeometricFallback = {
  readonly id: GeometricFallbackId;
  readonly path: string;
  readonly label: string;
};

export const GEOMETRIC_FALLBACKS: readonly GeometricFallback[] = [
  {
    id: 'rules',
    path: '/brand/atmosphere/fallback/rules.svg',
    label: 'Hairline rule grid',
  },
  {
    id: 'ledger',
    path: '/brand/atmosphere/fallback/ledger.svg',
    label: 'Horizontal ledger lines',
  },
  {
    id: 'pins',
    path: '/brand/atmosphere/fallback/pins.svg',
    label: 'Place-pin marks',
  },
  {
    id: 'tessellation',
    path: '/brand/atmosphere/fallback/tessellation.svg',
    label: 'Flat rectangular tessellation',
  },
] as const;

export function geometricFallbackById(id: GeometricFallbackId): GeometricFallback {
  const found = GEOMETRIC_FALLBACKS.find((entry) => entry.id === id);
  if (!found) {
    return GEOMETRIC_FALLBACKS[0]!;
  }
  return found;
}
