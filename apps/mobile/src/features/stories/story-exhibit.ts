/**
 * What a story image's exhibit label may say. A story image stores no kind, date or sensitivity,
 * so these read its own alt text and credit and say no more than they do. Ported from the web's
 * `apps/web/src/components/story/story-exhibit.ts`; keep the two in step.
 */
import type { ExhibitKind } from '@/ui';
import { resolveMapTone } from '@/features/map/kind-encoding';

type ImageWords = { readonly alt: string; readonly credit: string };

const DOCUMENT_WORDS =
  /\b(map|page|manuscript|letter|deed|form|certificate|newspaper|poster|postcard|broadside|ledger|schedule|document)\b/i;
const ARTWORK_WORDS =
  /\b(paint(?:ed|ing)|engrav(?:ed|ing)|lithograph|drawing|sketch|illustration|etching|woodcut)\b/i;
const PHOTOGRAPH_WORDS = /\bphotograph(?:ic|ed|s)?\b|\bphoto\b|\bdaguerreotype\b/i;

/** The kind the image's own words support, or undefined: then no kind is printed. */
export function storyImageKind(image: ImageWords): ExhibitKind | undefined {
  const words = `${image.alt} ${image.credit}`;
  if (ARTWORK_WORDS.test(words)) return undefined;
  if (PHOTOGRAPH_WORDS.test(words)) return 'photograph';
  if (DOCUMENT_WORDS.test(words)) return 'document';
  return undefined;
}

export function storyImageBasis(image: ImageWords): string {
  return /\b1[5-9]\d\d\b|\b20[0-2]\d\b/.test(image.credit)
    ? 'date in the credit'
    : 'date not on record';
}

/** A harm-adjacent image gets the quiet frame: no crop marks. */
export function isQuietImage(image: ImageWords): boolean {
  const tone = resolveMapTone({ displayName: `${image.alt} ${image.credit}` });
  return tone === 'massacre' || tone === 'plantation' || /\blynch/i.test(image.alt + image.credit);
}
