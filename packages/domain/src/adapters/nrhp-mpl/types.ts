/**
 * NRHP Multiple Property Listing adapter types for curated African American heritage MPL
 * metadata exports. These shapes describe inventory metadata only — not OCR text from MPL PDFs.
 */
import type { AdapterCandidateRecord } from '../types.js';
import type { NrhpMplAaCuratedTheme, NrhpMplAaHeritageRelevance } from './definition.js';

export type NrhpMplRawRecord = {
  readonly stableIdentifier?: string;
  readonly mplReference?: string;
  readonly title?: string;
  readonly canonicalUrl?: string;
  readonly classification?: string;
  readonly documentType?: string;
  readonly theme?: NrhpMplAaCuratedTheme | string;
  readonly aaHeritageRelevance?: NrhpMplAaHeritageRelevance | string;
  readonly thematicContext?: string;
  readonly coveragePeriod?: string;
  readonly stateCodes?: readonly string[];
  readonly propertyCountEstimate?: number;
};

export type NrhpMplRejectedRecord = {
  readonly index: number;
  readonly reason: string;
  readonly mplReference?: string;
  readonly title?: string;
};

export type NrhpMplParseResult = {
  readonly candidates: readonly NrhpMplCandidateRecord[];
  readonly rejected: readonly NrhpMplRejectedRecord[];
};

export type NrhpMplCandidatePayload = {
  readonly schemaVersion: string;
  readonly mplReference: string;
  readonly documentType: string;
  readonly theme: string;
  readonly aaHeritageRelevance: string;
  readonly stateCodes?: readonly string[];
  readonly thematicContext?: string;
  readonly coveragePeriod?: string;
  readonly propertyCountEstimate?: number;
  readonly strippedForbiddenKeys?: readonly string[];
};

export type NrhpMplCandidateRecord = AdapterCandidateRecord & {
  readonly payload: NrhpMplCandidatePayload;
};
