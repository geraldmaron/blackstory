/**
 * ISBN-normalized retailer purchase-link builders and validation-status helpers for banned-books
 * listing rows. Primary purchase path is Bookshop.org with an affiliate/referral id.
 */
import type { BannedBookPurchaseLink } from './types.js';

/** Default Bookshop.org affiliate id (must match `@repo/config` `BOOKSHOP_AFFILIATE_ID`). */
export const DEFAULT_BOOKSHOP_AFFILIATE_ID = 'gerald69' as const;

export type BuildIsbnPurchaseLinksOptions = {
  readonly bookshopAffiliateId?: string;
};

function normalizeIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

function isbn10ToIsbn13(isbn10: string): string {
  const base = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const digit = Number(base[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
}

function resolveIsbnVariants(isbn: string): { readonly retailerIsbn: string; readonly openLibraryIsbn: string } {
  const normalized = normalizeIsbn(isbn);
  if (normalized.length === 13) {
    return { retailerIsbn: normalized, openLibraryIsbn: normalized };
  }
  if (normalized.length === 10) {
    return { retailerIsbn: isbn10ToIsbn13(normalized), openLibraryIsbn: normalized };
  }
  return { retailerIsbn: normalized, openLibraryIsbn: normalized };
}

/**
 * Build up to two unchecked acquisition links from an ISBN (10 or 13):
 * Bookshop.org affiliate purchase link first, then Open Library catalog.
 */
export function buildIsbnPurchaseLinks(
  isbn13: string,
  options: BuildIsbnPurchaseLinksOptions = {},
): BannedBookPurchaseLink[] {
  const { retailerIsbn, openLibraryIsbn } = resolveIsbnVariants(isbn13);
  const affiliateId = (options.bookshopAffiliateId ?? DEFAULT_BOOKSHOP_AFFILIATE_ID).trim();
  if (!affiliateId) {
    throw new Error('buildIsbnPurchaseLinks requires a non-empty bookshopAffiliateId');
  }

  return [
    {
      retailer: 'bookshop',
      label: 'Buy on Bookshop.org',
      href: `https://bookshop.org/a/${encodeURIComponent(affiliateId)}/${encodeURIComponent(retailerIsbn)}`,
      validationStatus: 'unchecked',
    },
    {
      retailer: 'open-library',
      label: 'View on Open Library',
      href: `https://openlibrary.org/isbn/${encodeURIComponent(openLibraryIsbn)}`,
      validationStatus: 'unchecked',
    },
  ];
}

/** Return a copy of `link` with an updated validation status and timestamp. */
export function markPurchaseLinkValidation(
  link: BannedBookPurchaseLink,
  status: NonNullable<BannedBookPurchaseLink['validationStatus']>,
  validatedAt: string,
): BannedBookPurchaseLink {
  return Object.freeze({
    ...link,
    validationStatus: status,
    validatedAt,
  });
}
