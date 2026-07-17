/**
 * Plain-language explainer structure for access layer. Five sections at ~6th–8th grade
 * reading level; term-of-art links point to Wex rather than re-defining; complaint channels
 * link to official agencies only.
 */
import type { LegalLicenseTag } from './types.js';

export type LegalTermOfArtLink = {
  readonly term: string;
  readonly wexUrl: string;
};

export type LegalRightsBullet = {
  readonly label: string;
  readonly agencyUrl: string;
  readonly note?: string;
};

export type LegalPrimarySourceLink = {
  readonly label: string;
  readonly url: string;
  readonly archivedUrl?: string;
  readonly licenseTag: LegalLicenseTag;
};

/** Authoring pattern per law/case. */
export type LegalPlainLanguageExplainer = {
  /** One-sentence holding/provision plus exact citation reference. */
  readonly whatItSays: string;
  /** 2–4 short active-voice paragraphs one idea per sentence. */
  readonly whatItMeans: readonly string[];
  /** Historical context tied to Black American experience. */
  readonly whyItMatters: readonly string[];
  /** Bullets linking official complaint channels never paraphrasing ACLU. */
  readonly rightsToday: readonly LegalRightsBullet[];
  readonly primarySources: readonly LegalPrimarySourceLink[];
  /** Editorial review stamp ("reviewed YYYY-MM-DD"). */
  readonly reviewedAt: string;
  readonly termOfArtLinks?: readonly LegalTermOfArtLink[];
};

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertLegalPlainLanguageExplainerValid(explainer: LegalPlainLanguageExplainer): void {
  if (!isNonEmpty(explainer.whatItSays)) {
    throw new Error('LegalPlainLanguageExplainer.whatItSays must be non-empty');
  }
  if (explainer.whatItMeans.length < 1) {
    throw new Error('LegalPlainLanguageExplainer.whatItMeans must contain at least one paragraph');
  }
  if (explainer.whyItMatters.length < 1) {
    throw new Error('LegalPlainLanguageExplainer.whyItMatters must contain at least one paragraph');
  }
  if (!isNonEmpty(explainer.reviewedAt)) {
    throw new Error('LegalPlainLanguageExplainer.reviewedAt must be non-empty');
  }
  for (const bullet of explainer.rightsToday) {
    if (!isNonEmpty(bullet.label) || !isNonEmpty(bullet.agencyUrl)) {
      throw new Error('LegalRightsBullet requires label and agencyUrl');
    }
  }
  for (const source of explainer.primarySources) {
    if (!isNonEmpty(source.label) || !isNonEmpty(source.url)) {
      throw new Error('LegalPrimarySourceLink requires label and url');
    }
  }
}

/** Catalog row combining snapshot metadata with its plain-language layer. */
export type LegalCatalogEntry = {
  readonly snapshotId: string;
  readonly explainer: LegalPlainLanguageExplainer;
};

export function assertLegalCatalogEntryValid(entry: LegalCatalogEntry): void {
  if (!isNonEmpty(entry.snapshotId)) {
    throw new Error('LegalCatalogEntry.snapshotId must be non-empty');
  }
  assertLegalPlainLanguageExplainerValid(entry.explainer);
}
