/**
 * Safe external-link handling for citation URLs (MOB-014).
 *
 * The `Link` primitive in `src/ui/Link.tsx` (MOB-007) calls `Linking.openURL` unconditionally
 * with no scheme check — fine for internal, developer-authored hrefs, but citation `href`s are
 * server-relayed strings that ultimately trace back to a third-party source record, so this
 * bead's brief explicitly calls for an independent allowlist here rather than reusing that
 * primitive. This module is the "safe external-link mechanism": http/https only, `javascript:`/
 * `data:`/every other scheme rejected, evaluated defensively enough to resist known
 * scheme-obfuscation tricks (embedded control characters, leading/trailing whitespace).
 *
 * Belt-and-braces: `packages/public-contracts`'s `httpUrl` primitive already constrains a
 * citation's `href` to an absolute http(s) URL server-side, and `normalize.ts` already
 * re-checks every href against `isSafeExternalUrl` before it reaches a `Citation` object. This
 * module is the SECOND independent check, run again at the point of actually opening the link —
 * defense in depth, not a duplicate of the same trust decision.
 */
import { Linking } from 'react-native';

const MAX_URL_LENGTH = 2000;
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

/** Strips ASCII control characters (tabs, newlines, etc.) that some URL parsers ignore when
 * determining a scheme — a known `javascript:` obfuscation vector (e.g. `"java\tscript:..."`
 * or a leading `\n`). Never trust the scheme check on a string that still contains these. */
function stripControlChars(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) continue;
    result += value[i];
  }
  return result;
}

/**
 * Returns true only for a well-formed, bounded, http(s)-scheme absolute URL with no embedded
 * control characters. Rejects `javascript:`, `data:`, `file:`, bare relative paths, and any
 * other scheme outright — this is an ALLOWLIST, not a denylist, so an unrecognized future
 * scheme is rejected by default rather than requiring a new denylist entry.
 */
export function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  const cleaned = stripControlChars(value).trim();
  if (cleaned !== value.trim() || cleaned.length === 0) return false;

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (!schemeMatch) return false;
  const scheme = schemeMatch[1]!.toLowerCase() + ':';
  if (!ALLOWED_SCHEMES.has(scheme)) return false;

  // Structural shape check mirroring public-contracts' httpUrl regex: scheme, non-empty
  // authority, no whitespace.
  return /^https?:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i.test(cleaned);
}

export type OpenLinkResult = 'opened' | 'blocked-unsafe-url' | 'offline' | 'failed';

/**
 * Opens a citation URL through React Native's `Linking`, gated on the allowlist above and on
 * caller-reported connectivity. Never throws — a rejected/unreachable/offline link degrades to
 * a returned status the caller renders as a message (see `CitationLink.tsx`), never a crash and
 * never a silent no-op the user can't distinguish from "nothing happened."
 */
export async function openExternalLink(url: string, opts: { isOnline: boolean }): Promise<OpenLinkResult> {
  if (!isSafeExternalUrl(url)) return 'blocked-unsafe-url';
  if (!opts.isOnline) return 'offline';
  try {
    await Linking.openURL(url);
    return 'opened';
  } catch {
    return 'failed';
  }
}
