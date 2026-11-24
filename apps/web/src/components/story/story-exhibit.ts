/**
 * What a story image's exhibit frame may say about it (docs/ui/DESIGN.md sections 7.3 and 9.3).
 *
 * A story image stores a URL, alt text, a credit and a rights status. It stores no kind, no date
 * and no sensitivity flag, so each answer here is read from the words the story already carries
 * and says no more than they do.
 *
 * shortcut: kind, date and quiet are read from alt and credit text, because the image has no
 * field for them. Replace with `kind`, `date`, `dateBasis` and `sensitivity` on
 * `storyImageSchema` when the data carries them.
 */
import type { StoryImageDoc } from '@repo/schemas';
import type { ExhibitKind } from '@repo/ui';
import { resolveMapTone } from '../../lib/map-experience/kind-encoding';

type ImageWords = Pick<StoryImageDoc, 'url' | 'alt' | 'credit'>;

const DOCUMENT_WORDS =
  /\b(map|page|manuscript|letter|deed|form|certificate|newspaper|poster|postcard|broadside|ledger|schedule|document)\b/i;
const ARTWORK_WORDS =
  /\b(paint(?:ed|ing)|engrav(?:ed|ing)|lithograph|drawing|sketch|illustration|etching|woodcut)\b/i;
const PHOTOGRAPH_WORDS = /\bphotograph(?:ic|ed|s)?\b|\bphoto\b|\bdaguerreotype\b/i;

/**
 * Photograph, document, or undefined when the words do not say (a painting, an engraving, an
 * image nobody described). The caller frames an unknown kind without a kind label rather than
 * calling a painting a photograph.
 */
export function storyImageKind(image: ImageWords): ExhibitKind | undefined {
  const words = `${image.alt} ${image.credit}`;
  if (ARTWORK_WORDS.test(words)) return undefined;
  if (PHOTOGRAPH_WORDS.test(words)) return 'photograph';
  if (DOCUMENT_WORDS.test(words)) return 'document';
  return undefined;
}

/**
 * The label's date line. The image has no date field, so the most this can say is whether its
 * credit states one; it never prints a year of its own or says what that year means.
 */
export function storyImageBasis(image: ImageWords): string {
  return /\b1[5-9]\d\d\b|\b20[0-2]\d\b/.test(image.credit)
    ? 'date in the credit'
    : 'date not on record';
}

/** Harm-adjacent by its own words: the record pages' name rule, read over the alt and credit. */
export function isQuietImage(image: ImageWords): boolean {
  const tone = resolveMapTone({ displayName: `${image.alt} ${image.credit}` });
  return tone === 'massacre' || tone === 'plantation' || /\blynch/i.test(image.alt + image.credit);
}

/**
 * The exhibit's address: the stored file's own name, so it survives the story being re-ordered.
 * Never derived from the image's position on the page.
 */
export function storyImageId(image: ImageWords): string {
  let name = image.url.split(/[?#]/)[0]!.split('/').filter(Boolean).pop() ?? '';
  try {
    name = decodeURIComponent(name);
  } catch {
    // A malformed escape: slug the raw name.
  }
  const slug = name
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `image-${slug || 'file'}`;
}

export const RIGHTS_LABEL = {
  public_domain: 'In the public domain',
  licensed: 'Used under license',
  fair_use: 'Used under fair use',
} as const;
