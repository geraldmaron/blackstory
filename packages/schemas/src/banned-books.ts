/**
 * Zod schemas for the banned-books listing corpus.
 * Mirrors packages/domain/src/banned-books/types.ts and validates snapshot payloads,
 * migration imports, and publication pipelines without importing domain runtime code.
 */
import { z } from 'zod';

const kebabSlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const publishedDateRegex = /^\d{4}(-\d{2}-\d{2})?$/;

/** 50 states + DC — kept in schemas so Zod validation does not import @repo/domain. */
const USPS_STATE_CODES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
] as const;

export const uspsStateCodeSchema = z.enum(USPS_STATE_CODES);

export const bannedBookAuthorSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['author', 'editor', 'illustrator', 'contributor']).optional(),
});
export type BannedBookAuthor = z.infer<typeof bannedBookAuthorSchema>;

export const bannedBookIdentifierSchema = z.object({
  system: z.enum(['isbn-13', 'isbn-10', 'asin', 'oclc', 'open-library', 'other']),
  value: z.string().min(1),
});
export type BannedBookIdentifier = z.infer<typeof bannedBookIdentifierSchema>;

export const bannedBookCitationSchema = z.object({
  label: z.string().min(1),
  href: z.string().url(),
  publisher: z.string().min(1).optional(),
  publishedAt: z.string().min(1).optional(),
});
export type BannedBookCitation = z.infer<typeof bannedBookCitationSchema>;

export const bannedBookPurchaseLinkSchema = z.object({
  retailer: z.enum(['bookshop', 'amazon', 'barnes-noble', 'open-library', 'publisher', 'other']),
  label: z.string().min(1),
  href: z.string().url(),
  validatedAt: z.string().min(1).optional(),
  validationStatus: z.enum(['valid', 'invalid', 'unchecked']).optional(),
});
export type BannedBookPurchaseLink = z.infer<typeof bannedBookPurchaseLinkSchema>;

export const bannedBookChallengeSchema = z.object({
  state: uspsStateCodeSchema,
  jurisdictionLabel: z.string().min(1).optional(),
  schoolYear: z.string().min(1).optional(),
  challengeYear: z.number().int().optional(),
  status: z.enum(['reported', 'rescinded', 'unknown']),
  citation: bannedBookCitationSchema,
});
export type BannedBookChallenge = z.infer<typeof bannedBookChallengeSchema>;

export const bannedBookProvenanceSchema = z.object({
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  retrievedAt: z.string().min(1),
  contentHash: z.string().min(1),
});
export type BannedBookProvenance = z.infer<typeof bannedBookProvenanceSchema>;

export const bannedBookRecordSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).regex(kebabSlugRegex),
  title: z.string().min(1),
  authors: z.array(bannedBookAuthorSchema).min(1),
  identifiers: z.array(bannedBookIdentifierSchema),
  description: z.string().min(40).max(600),
  publishedDate: z.string().regex(publishedDateRegex),
  challenges: z.array(bannedBookChallengeSchema),
  citations: z.array(bannedBookCitationSchema).min(3),
  purchaseLinks: z.array(bannedBookPurchaseLinkSchema).max(3),
  canonicalEntityId: z.string().min(1).optional(),
  provenance: bannedBookProvenanceSchema,
});
export type BannedBookRecord = z.infer<typeof bannedBookRecordSchema>;

export const bannedBooksListingSnapshotSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().min(1),
  books: z.array(bannedBookRecordSchema),
});
export type BannedBooksListingSnapshot = z.infer<typeof bannedBooksListingSnapshotSchema>;

export const BANNED_BOOKS_SNAPSHOT_NAME = 'bannedBooksListing' as const;
