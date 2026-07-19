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

const PAGE_FIELD_BASE = '/brand/atmosphere/page-field';

export const PAGE_FIELD_MOTIF_IDS = ['rules', 'ledger', 'pins', 'bands'] as const;

export type PageFieldMotifId = (typeof PAGE_FIELD_MOTIF_IDS)[number];

export type PageFieldMotif = {
  readonly id: PageFieldMotifId;
  readonly lightPath: string;
  readonly darkPath: string;
  readonly label: string;
};

export const PAGE_FIELD_MOTIFS: readonly PageFieldMotif[] = [
  {
    id: 'rules',
    lightPath: `${PAGE_FIELD_BASE}/rules-light.svg`,
    darkPath: `${PAGE_FIELD_BASE}/rules-dark.svg`,
    label: 'Hairline rule grid',
  },
  {
    id: 'ledger',
    lightPath: `${PAGE_FIELD_BASE}/ledger-light.svg`,
    darkPath: `${PAGE_FIELD_BASE}/ledger-dark.svg`,
    label: 'Horizontal ledger lines',
  },
  {
    id: 'pins',
    lightPath: `${PAGE_FIELD_BASE}/pins-light.svg`,
    darkPath: `${PAGE_FIELD_BASE}/pins-dark.svg`,
    label: 'Place-pin marks',
  },
  {
    id: 'bands',
    lightPath: `${PAGE_FIELD_BASE}/bands-light.svg`,
    darkPath: `${PAGE_FIELD_BASE}/bands-dark.svg`,
    label: 'Flat page-band fills',
  },
] as const;

export function pageFieldMotifById(id: PageFieldMotifId): PageFieldMotif {
  const found = PAGE_FIELD_MOTIFS.find((entry) => entry.id === id);
  if (!found) {
    return PAGE_FIELD_MOTIFS[0]!;
  }
  return found;
}
