/**
 * public metadata builders canonical URLs and Open Graph previews with protected
 * fields stripped before anything is emitted to HTML head tags or link unfurlers.
 */
import type { Metadata } from 'next';
import { sanitizePublicProseText } from '@repo/domain/editorial';
import { isNoIndexPath } from '../nav/destination-registry';
import {
  sanitizePreviewText,
  stripProtectedFields,
  type MetadataPreviewInput,
  type PublicMetadataPreview,
} from './protected-fields';

export type EntityMetadataSource = {
  readonly id: string;
  readonly displayName: string;
  readonly summary?: string;
  readonly kind?: string;
  readonly imageUrl?: string;
  readonly confidenceScore?: number;
  readonly mapPin?: { readonly x: number; readonly y: number };
  readonly sensitivity?: {
    readonly class: string;
    readonly note?: string;
    readonly basisClaimIds?: readonly string[];
  };
  readonly disputeNote?: string;
};

export type StaticPageMetadataSource = MetadataPreviewInput & {
  readonly path: string;
};

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048';
}

/**
 * The absolute form of a public path, for the routes that build their own `alternates` rather
 * than going through {@link buildStaticPageMetadata} — Explore, which must not carry a title,
 * and `/records`, whose canonical carries a narrowing. A relative canonical is only resolved by
 * Next when `metadataBase` is set, and it is not; a relative one would emit as-is and mean
 * nothing to a crawler, so absolute is the whole site's convention.
 */
export function absolutePublicUrl(path: string): string {
  return absoluteUrl(path);
}

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, siteOrigin()).toString();
}

/**
 * Builds a Next.js Metadata object for static public pages.
 */
export function buildStaticPageMetadata(source: StaticPageMetadataSource): Metadata {
  // `noIndex` defaults to the registry's answer for this path rather than to false, so a route
  // marked noIndex there cannot ship an indexable head by forgetting to repeat the flag here.
  const noIndex = source.noIndex ?? isNoIndexPath(source.path);
  const preview = buildPublicMetadataPreview({
    ...(source.title !== undefined ? { title: source.title } : {}),
    ...(source.description !== undefined ? { description: source.description } : {}),
    canonicalPath: source.path,
    ...(source.imageUrl !== undefined ? { imageUrl: source.imageUrl } : {}),
    ...(noIndex ? { noIndex: true } : {}),
  });
  return toNextMetadata(preview);
}

/**
 * Builds preview-safe metadata for entity detail pages from a projection or seed record.
 */
export function buildEntityPageMetadata(source: EntityMetadataSource): Metadata {
  const safe = stripProtectedFields(source);
  const title = sanitizePreviewText(safe.displayName, 'BlackStory record');
  const description = sanitizePreviewText(
    safe.summary !== undefined ? sanitizePublicProseText(safe.summary) : undefined,
    `Published ${safe.kind ?? 'record'} in the BlackStory public catalog.`,
  );
  const preview = buildPublicMetadataPreview({
    title,
    description,
    canonicalPath: `/entity/${source.id}`,
    ...(typeof safe.imageUrl === 'string' && safe.imageUrl.length > 0
      ? { imageUrl: safe.imageUrl }
      : {}),
  });
  return toNextMetadata(preview);
}

/**
 * Pure preview shape for tests and non-Next consumers.
 */
export function buildPublicMetadataPreview(input: MetadataPreviewInput): PublicMetadataPreview {
  const title = sanitizePreviewText(input.title, 'BlackStory');
  const description = sanitizePreviewText(
    input.description,
    'Place-connected Black history research with published claims, provenance, and confidence.',
  );
  const canonicalPath = input.canonicalPath;
  const openGraph: PublicMetadataPreview['openGraph'] = {
    title,
    description,
    ...(canonicalPath !== undefined ? { url: absoluteUrl(canonicalPath) } : {}),
    ...(input.imageUrl !== undefined
      ? { images: Object.freeze([{ url: absoluteUrl(input.imageUrl) }]) }
      : {}),
  };
  // `follow` stays true even when noindexed (SP-19). A noindexed page is still part of the link
  // graph — /design-system links the room kit, and telling a crawler to drop those links as well
  // discards the crawl for no benefit. "Do not list this page" and "ignore where it points" are
  // separate instructions, and only the first one was ever wanted here.
  const robots =
    input.noIndex === true
      ? Object.freeze({ index: false, follow: true })
      : Object.freeze({ index: true, follow: true });

  return Object.freeze({
    title,
    description,
    ...(canonicalPath !== undefined ? { canonicalPath } : {}),
    openGraph,
    robots,
  });
}

function toNextMetadata(preview: PublicMetadataPreview): Metadata {
  const metadata: Metadata = {
    title: preview.title,
    description: preview.description,
    openGraph: {
      title: preview.openGraph?.title,
      description: preview.openGraph?.description,
      ...(preview.openGraph?.url !== undefined ? { url: preview.openGraph.url } : {}),
      ...(preview.openGraph?.images !== undefined ? { images: [...preview.openGraph.images] } : {}),
    },
    robots: preview.robots,
  };
  if (preview.canonicalPath !== undefined) {
    metadata.alternates = { canonical: absoluteUrl(preview.canonicalPath) };
  }
  return metadata;
}
