/**
 * User-facing copy for native Themes. No em dashes.
 */

export const THEMES_INTRO = {
  kicker: 'Impact',
  title: 'Themes',
  lede:
    'Policy-impact reading room: canonical questions with cited packets, gap labels, and explicit juxtaposition (not causation). Coverage is incomplete by design.',
} as const;

export const THEMES_METHOD = {
  title: 'Juxtaposition, not causation',
  body:
    'Theme packets place policy eras beside observations and artifacts. Co-movement is not treated as proof of cause. Read Methodology for confidence grades, gap labels, and when impact language is allowed.',
  methodologyCta: 'Open Methodology',
} as const;

export const THEMES_CATALOG = {
  p0Title: 'Themes with live packets',
  p0Lede:
    'Redlining and drug policy packets connect primary records to measured outcomes while keeping geography, time, and evidentiary limits visible.',
  p1Title: 'Coming next',
  p1Lede: 'Priority P1 themes with researched packets on device. Warehouse refresh comes later.',
  searchPlaceholder: 'Search themes…',
  emptyTitle: 'No themes matched',
  emptyBody: 'Try a broader keyword.',
  emptyAction: 'Clear search',
  seedNote:
    'On-device curated fixture from researched theme-impact packets. Live warehouse refresh needs a mobile Themes API.',
} as const;

export const THEMES_DETAIL = {
  introKicker: 'Theme packet',
  methodTitle: 'Method',
  packetsTitle: 'Canonical questions',
  packetsLede: 'Each packet keeps geography, eras, gap labels, and provenance visible.',
  observationsTitle: 'Observations',
  derivedTitle: 'Derived',
  artifactsTitle: 'Artifacts',
  gapsTitle: 'Gap labels',
  geographyLabel: 'Geography',
  erasLabel: 'Policy eras',
  missingTitle: 'Theme not found',
  missingBody: 'That theme is not in this release. Return to Themes and pick another.',
  backCta: 'Back to Themes',
  methodologyCta: 'Open Methodology',
} as const;

export const THEMES_GAP_COPY = {
  insufficient_evidence: {
    title: 'Insufficient evidence',
    body:
      'This packet does not yet meet the citation or coverage bar for a full answer. What appears is labeled; gaps stay visible rather than filled with inference.',
  },
  modeled: {
    title: 'Modeled estimate',
    body:
      'At least one figure here is derived or modeled, not a direct primary count. Read the provenance list and method note before treating it as a raw observation.',
  },
} as const;

export const THEMES_METHOD_STANCE = {
  juxtaposition: 'Juxtaposition, not causation',
  gated_causal_claim: 'Gated causal claim',
} as const;
