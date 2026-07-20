/**
 * Presentation copy for legal landscape web components.
 */
export const LEGAL_DISCLAIMER_TITLE = 'Not legal advice';
export const LEGAL_DISCLAIMER_BODY =
  'BlackStory explains public laws and court decisions in plain language. This is general information, not legal advice. ' +
  'For advice about your specific situation, consult a licensed attorney or a qualified legal aid organization.';

export const LEGAL_SECTION_LABELS = {
  whatItSays: 'What the law says',
  whatItMeans: 'What it means',
  whyItMatters: 'Why it matters for Black Americans',
  rightsToday: 'Your rights today',
  primarySources: 'Primary sources',
} as const;

export const LAW_BROWSE_LEDE =
  'Landmark federal statutes, regulations, and court decisions that shape civil rights — explained in plain language with links to official sources and canonical fact records.';

/** @deprecated Use LAW_BROWSE_LEDE — kept for internal seed/catalog references only. */
export const LEGAL_BROWSE_LEDE = LAW_BROWSE_LEDE;

export const LEGAL_KIND_LABELS: Readonly<Record<string, string>> = {
  'federal-statute': 'Federal statute',
  'federal-regulation': 'Federal regulation',
  'landmark-case': 'Landmark case',
  'state-statute': 'State law',
};

export const LEGAL_TOPIC_LABELS: Readonly<Record<string, string>> = {
  voting: 'Voting',
  housing: 'Housing',
  employment: 'Employment',
  education: 'Education',
  policing: 'Policing',
  constitutional: 'Constitutional',
  'criminal-justice': 'Criminal justice',
};
