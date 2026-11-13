/**
 * schema.org JSON-LD for a released record page (`/place/{slug}`, `/invention/{slug}`).
 *
 * Search engines read a record page as an anonymous web page unless it says what it is about.
 * This names the subject (a Place, or a CreativeWork for an invention) and ties it to the
 * jurisdiction it sits in, which is how a page answers a query like "Farish Street Jackson
 * Mississippi history".
 *
 * Precision law: no `geo` and no street `address`. A point is never published sharper than its
 * stored precision, and structured data is a second publication channel that a reader never sees,
 * so it carries only the coarse `jurisdictionLabel` the page already shows. Protected fields
 * (scores, sensitivity notes) never enter: the input type only admits the four public strings.
 */
import { assertNeverClaimReview } from '@repo/domain';
import { absolutePublicUrl } from './metadata-builders';
import { sanitizePreviewText } from './protected-fields';

export type RecordJsonLdSource = {
  readonly family: 'place' | 'invention';
  readonly slug: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly jurisdictionLabel?: string;
};

/** The canonical public path of a record page. The slug is carried verbatim, so a
 * disambiguated `{slug}--{entityId}` address stays its own canonical. */
export function recordCanonicalPath(family: RecordJsonLdSource['family'], slug: string): string {
  return `/${family}/${slug}`;
}

export function buildRecordJsonLd(source: RecordJsonLdSource): Record<string, unknown> {
  const url = absolutePublicUrl(recordCanonicalPath(source.family, source.slug));
  const description =
    source.summary !== undefined && source.summary.trim().length > 0
      ? sanitizePreviewText(source.summary, source.displayName)
      : undefined;
  const jurisdiction = source.jurisdictionLabel?.trim();
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': source.family === 'invention' ? 'CreativeWork' : 'Place',
    '@id': url,
    url,
    name: source.displayName,
    ...(description !== undefined ? { description } : {}),
    ...(source.family === 'place' && jurisdiction
      ? { containedInPlace: { '@type': 'Place', name: jurisdiction } }
      : {}),
    mainEntityOfPage: url,
    isPartOf: { '@type': 'WebSite', name: 'BlackStory', url: absolutePublicUrl('/') },
  };
  assertNeverClaimReview(jsonLd);
  return jsonLd;
}

/** Serialized for a `<script type="application/ld+json">`; `<` is escaped so a record name or
 * summary can never close the script element. */
export function serializeJsonLd(jsonLd: Record<string, unknown>): string {
  return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}
