import { isSafeStoryLinkHref } from '@repo/schemas/story-inline';

export type LinkInput = { readonly href: string } | { readonly problem: string };

const BARE_DOMAIN = /^[^\s/:@]+\.[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;

/** What a writer typed or pasted in the link field -> an https address, or the problem in words. */
export function normalizeLinkInput(raw: string): LinkInput {
  const value = raw.trim();
  if (!value) return { problem: 'Paste a web address that starts with https://.' };
  if (/^http:\/\//i.test(value))
    return {
      problem: 'Only https:// links are allowed. Use the https:// version of this address.',
    };
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(value) &&
    !/^https:\/\//i.test(value) &&
    !/^[^\s/:]+:\d+/.test(value)
  )
    return { problem: 'Only https:// web links are allowed.' };
  const href = /^https:\/\//i.test(value)
    ? value
    : BARE_DOMAIN.test(value)
      ? `https://${value}`
      : '';
  if (!href || !isSafeStoryLinkHref(href))
    return {
      problem: 'That is not a complete web address. It should look like https://example.org/page.',
    };
  return { href };
}
