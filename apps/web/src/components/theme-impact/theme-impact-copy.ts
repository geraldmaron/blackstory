/**
 * Approved user-facing copy for theme-impact surfaces: gap banners, empty indicators,
 * and missing provenance notices. Centralized so detail and question routes stay
 * consistent and free of em dashes in UI chrome.
 */

export type ThemeImpactGapState = 'insufficient_evidence' | 'modeled';

export type ThemeImpactGapCopy = {
  readonly tone: 'warning' | 'dispute';
  readonly title: string;
  readonly body: string;
};

export const THEME_IMPACT_GAP_COPY: Readonly<
  Record<ThemeImpactGapState, ThemeImpactGapCopy>
> = {
  insufficient_evidence: {
    tone: 'warning',
    title: 'Insufficient evidence',
    body:
      'This packet does not yet meet the citation or coverage bar for a full answer. What appears is labeled; gaps stay visible rather than filled with inference.',
  },
  modeled: {
    tone: 'dispute',
    title: 'Modeled estimate',
    body:
      'At least one figure here is derived or modeled, not a direct primary count. Read the provenance list and method note before treating it as a raw observation.',
  },
};

export type ThemeImpactEmptyKind = 'indicators' | 'provenance' | 'observations';

export type ThemeImpactEmptyCopy = {
  readonly title: string;
  readonly body: string;
};

export const THEME_IMPACT_EMPTY_COPY: Readonly<
  Record<ThemeImpactEmptyKind, ThemeImpactEmptyCopy>
> = {
  indicators: {
    title: 'No indicators loaded',
    body:
      'Warehouse observations for this packet are not available yet. Policy eras and gap labels may still appear for context.',
  },
  provenance: {
    title: 'No sources linked yet',
    body:
      'Citation rows have not been attached to this packet yet. Check back after the next warehouse ingest.',
  },
  observations: {
    title: 'No observations loaded',
    body:
      'Statistical observations and derived measurements are not available for this packet yet. Gap labels stay visible when coverage is partial.',
  },
};

/** Fallback when a metric value is missing from warehouse rows. */
export const THEME_IMPACT_MISSING_VALUE_LABEL = 'Not loaded';

export const THEME_IMPACT_METHOD_STANCE_LABEL = 'Juxtaposition, not causation';

export const THEME_IMPACT_METHOD_STANCE_COMPACT = 'Juxtaposition · not causation';
