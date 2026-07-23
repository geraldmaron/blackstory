/**
 * public metadata builders canonical URLs and Open Graph previews with protected
 * fields stripped before anything is emitted to HTML head tags or link unfurlers.
 */
import type { Metadata } from 'next';
import { sanitizePublicProseText } from '@repo/domain/editorial';
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
  const preview = buildPublicMetadataPreview({
    ...(source.title !== undefined ? { title: source.title } : {}),
    ...(source.description !== undefined ? { description: source.description } : {}),
    canonicalPath: source.path,
    ...(source.imageUrl !== undefined ? { imageUrl: source.imageUrl } : {}),
    ...(source.noIndex !== undefined ? { noIndex: source.noIndex } : {}),
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
  const robots =
    input.noIndex === true
      ? Object.freeze({ index: false, follow: false })
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
