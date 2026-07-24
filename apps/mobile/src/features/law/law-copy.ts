/**
 * User-facing copy for native Law. No em dashes.
 */
export const LAW_INTRO = {
  kicker: 'Reference',
  title: 'Law',
  lede:
    'Landmark federal statutes, regulations, and court decisions that shape civil rights, explained in plain language with links to official sources.',
} as const;

export const LAW_DISCLAIMER = {
  title: 'Not legal advice',
  body:
    'BlackStory explains public laws and court decisions in plain language. This is general information, not legal advice. For advice about your specific situation, consult a licensed attorney or a qualified legal aid organization.',
} as const;

export const LAW_CATALOG = {
  title: 'Catalog',
  lede: 'Search by title, citation, or topic. Tap a row for the plain-language explainer when available.',
  searchPlaceholder: 'Search laws or citations…',
  emptyTitle: 'No entries matched',
  emptyBody: 'Try a broader keyword or clear filters.',
  seedNote:
    'Catalog from the curated on-device legal snapshot. Live refresh ships when the mobile API exposes the listing.',
} as const;

export const LAW_ABOUT = {
  title: 'How to read this room',
  lede:
    'Entries cite official sources and archived captures. Status labels describe the current legal standing of the instrument, not a prediction of future outcomes.',
} as const;

export const LAW_DETAIL = {
  introKicker: 'Law entry',
  anatomyTitle: 'At a glance',
  saysTitle: 'What the law says',
  meansTitle: 'What it means',
  mattersTitle: 'Why it matters for Black Americans',
  rightsTitle: 'Your rights today',
  sourcesTitle: 'Primary sources',
  termsTitle: 'Terms of art',
  provenanceTitle: 'Provenance',
  keepGoingTitle: 'Keep going',
  officialCta: 'Open official source',
  archiveCta: 'Open archived capture',
  entityCta: 'Open linked record',
  missingTitle: 'Law entry not found',
  missingBody: 'That catalog entry is not in this release. Return to Law and pick another entry.',
} as const;

export const LAW_KIND_LABELS: Readonly<Record<string, string>> = {
  'federal-statute': 'Federal statute',
  'federal-regulation': 'Federal regulation',
  'landmark-case': 'Landmark case',
  'state-statute': 'State law',
};

export const LAW_TOPIC_LABELS: Readonly<Record<string, string>> = {
  voting: 'Voting',
  housing: 'Housing',
  employment: 'Employment',
  education: 'Education',
  policing: 'Policing',
  constitutional: 'Constitutional',
  'criminal-justice': 'Criminal justice',
};

export const LAW_STATUS_LABELS: Readonly<Record<string, string>> = {
  in_force: 'In force',
  amended: 'Amended',
  repealed: 'Repealed',
  struck_down: 'Struck down',
  enjoined: 'Enjoined',
};

export const LAW_JURISDICTION_LABELS: Readonly<Record<string, string>> = {
  us: 'United States',
  'us-13': 'Georgia',
};
