/**
 * One page, one key.
 *
 * Two spellings of the same address are the same document, and a research lane that cannot see
 * that will fetch one page twice and then count the two results as two sources. That is not a
 * tidiness problem: independence is the whole basis of corroboration, and a duplicate that looks
 * independent is worse than an obvious duplicate.
 *
 * This produces a DEDUPE KEY, not a replacement URL. The original string stays the thing we
 * fetch and cite, because a canonicalization that silently rewrote what we requested would make
 * the citation a claim about a URL nobody ever retrieved. Callers dedupe on the key and keep the
 * input.
 *
 * Deliberately NOT done here:
 *  - http is not upgraded to https. `normalizeAuthorityUrl` does that for follow-up intake, where
 *    the point is to reach a gate that wants https. Here it would merge two addresses that can
 *    genuinely serve different content.
 *  - no host is rejected. This answers "are these the same page", not "may we fetch it" — that
 *    question belongs to the safe-fetch policy and must not be smuggled in here.
 *  - trailing-slash-vs-not is treated as the SAME key only at the root, where it is always the
 *    same resource. Deeper paths can differ, and guessing costs a real source.
 */

/** Query parameters that identify a referral, never a document. */
const TRACKING_PARAM_PATTERN =
  /^(?:utm_|fbclid$|gclid$|mc_|msclkid$|igshid$|s_cid$|ref$|ref_src$)/iu;

/**
 * A stable key for "the same page", or `undefined` when the input is not an http(s) URL.
 *
 * Unfetchable and unparseable inputs return `undefined` rather than a key, so a caller deduping
 * a list can keep them out of the set instead of collapsing every malformed entry into one.
 */
export function urlDedupeKey(rawUrl: string): string | undefined {
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;

  // A fragment is a position within a document, not a different document.
  parsed.hash = '';
  // Credentials in a URL say who is asking, not what is being asked for.
  parsed.username = '';
  parsed.password = '';

  // `new URL` lowercases the host and drops a default port already; a trailing dot is the same
  // name to DNS and a different string to everything else.
  const hostname = parsed.hostname.replace(/\.$/u, '');

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAM_PATTERN.test(key)) parsed.searchParams.delete(key);
  }
  // Parameter order is not document identity: ?a=1&b=2 and ?b=2&a=1 are one page.
  parsed.searchParams.sort();
  const search = parsed.searchParams.toString();

  // Only the root is safe to treat as slash-insensitive.
  // %2f and %2F are the same octet, so the hex digits are upper-cased to one spelling. The escape
  // itself is preserved: decoding it would merge a literal slash with an encoded one.
  const pathname =
    parsed.pathname === '/'
      ? ''
      : parsed.pathname.replace(/%[0-9a-f]{2}/gu, (escape) => escape.toUpperCase());

  return `${parsed.protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ''}${pathname}${
    search ? `?${search}` : ''
  }`;
}

/**
 * Dedupes a list of URLs by page identity, preserving first-seen order and the original strings.
 *
 * An entry with no derivable key (not http(s), unparseable) is kept on its exact trimmed string,
 * so a caller still sees it once rather than losing it or merging it with other bad input.
 */
export function dedupeUrlsByPage(urls: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const key = urlDedupeKey(trimmed) ?? `raw:${trimmed}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}
