/**
 * Law catalog types for native mobile — compact snapshot of web legal seed.
 */
export type LawSnapshotKind =
  | 'federal-statute'
  | 'federal-regulation'
  | 'constitutional-amendment'
  | 'landmark-case'
  | 'state-statute';

export type LawStatus =
  | 'in_force'
  | 'amended'
  | 'repealed'
  | 'struck_down'
  | 'enjoined';

export type LawTopic =
  | 'voting'
  | 'housing'
  | 'employment'
  | 'education'
  | 'policing'
  | 'constitutional'
  | 'criminal-justice';

export type LawRightsLink = {
  readonly label: string;
  readonly agencyUrl: string;
};

export type LawPrimarySource = {
  readonly label: string;
  readonly url: string;
  readonly licenseTag: string;
};

export type LawTermOfArt = {
  readonly term: string;
  readonly wexUrl: string;
};

export type LawExplainer = {
  readonly whatItSays: string;
  readonly whatItMeans: readonly string[];
  readonly whyItMatters: readonly string[];
  readonly rightsToday: readonly LawRightsLink[];
  readonly primarySources: readonly LawPrimarySource[];
  readonly reviewedAt: string;
  readonly termOfArtLinks?: readonly LawTermOfArt[];
};

export type LawCatalogEntry = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kind: LawSnapshotKind;
  readonly lawStatus: LawStatus;
  readonly jurisdictionId: string;
  readonly topics: readonly LawTopic[];
  readonly citation: string;
  readonly sourceUrl: string;
  readonly officialUrl: string;
  readonly archivedCaptureUrl: string;
  readonly retrievedAt: string;
  readonly licenseTag: string;
  readonly factId?: string;
  readonly canonicalEntityId?: string;
  readonly explainer?: LawExplainer;
};

export type LawCatalogSnapshot = {
  readonly version: string;
  readonly generatedAt: string;
  readonly entries: readonly LawCatalogEntry[];
};

/** Compact row model for the browse ledger. */
export type LawCatalogRow = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kind: LawSnapshotKind;
  readonly kindLabel: string;
  readonly lawStatus: LawStatus;
  readonly statusLabel: string;
  readonly citation: string;
  readonly topicsLabel: string;
  readonly hasExplainer: boolean;
};
