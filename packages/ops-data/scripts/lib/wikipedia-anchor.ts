/**
 * Is a captured Wikipedia page anchored to the record, or only found by its name?
 *
 * In the 2026-11-25 burn-down pilot, 9 of the 10 wrong-subject captures were Wikipedia pages
 * looked up by a bare name: a pirate for an Iota Phi Theta founder named Albert Hicks, the saint
 * for a DC church named for her, a Philadelphia church for one in DC, Gordon Ramsay for an
 * enslaved man named Gordon. Each passed the identity gate on name and focus. A context-word rule
 * caught only half of them, so the rule here is structural. A Wikipedia page counts when it is the
 * article the record itself links to (its canonical URL), when its title is exactly the record's
 * name and no known place contradicts it, or when the record carries a place the page agrees with.
 * Every pilot namesake had a different title ("Albert W. Hicks", "John Slade (politician)"); the
 * exact-title case keeps the correct pages the sweep needs as seeds for reference hops.
 */

/** Titles differ in dashes, periods, apostrophes and a leading "The"; none of that is identity. */
function fold(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[.'\u2019,]/gu, '')
    .replace(/[\u2010-\u2015-]/gu, ' ')
    .replace(/^the\s+/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function wikiTitle(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = /^\/wiki\/(.+)$/u.exec(parsed.pathname);
    if (!match) return null;
    return fold(decodeURIComponent(match[1]!).replaceAll('_', ' '));
  } catch {
    return null;
  }
}

export function wikipediaPageAnchored(input: {
  readonly sourceUrl: string;
  readonly canonicalUrl?: string | undefined;
  readonly displayName?: string | undefined;
  readonly placeKnown?: boolean | undefined;
  readonly placeCorroborated?: boolean | undefined;
}): boolean {
  const page = wikiTitle(input.sourceUrl);
  const linked = input.canonicalUrl ? wikiTitle(input.canonicalUrl) : null;
  if (page !== null && linked !== null && page === linked) return true;
  if (input.placeKnown === true) return input.placeCorroborated === true;
  // A trailing "(Site)" or similar qualifier on the record's own name is not part of the subject.
  const name = fold((input.displayName ?? '').replace(/\s*\([^)]*\)\s*$/u, ''));
  // A one-word name is too ambiguous to anchor anything: "Gabriel" is the archangel's article.
  return page !== null && name.includes(' ') && page === name;
}
