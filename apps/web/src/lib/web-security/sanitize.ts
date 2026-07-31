/**
 * Output encoding and HTML sanitization without third-party deps.
 * Prefer escapeHtml for plain text; sanitizeRichText for markdown/HTML fragments.
 */

import {
  RICH_TEXT_ALLOWED_ATTRS,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URI_SCHEMES,
} from './constants';

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Encode plain text for HTML text nodes and attributes.  */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

/** Encode for embedding inside a double-quoted HTML attribute.  */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

const BLOCKED_TAG_NAMES =
  'script|iframe|object|embed|form|input|button|textarea|select|meta|link|base|style|svg|math';
const BLOCKED_TAG_PATTERN = new RegExp(
  `<\\/?(?:${BLOCKED_TAG_NAMES})[^>]*>[\\s\\S]*?<\\/(?:${BLOCKED_TAG_NAMES})>|<(?:${BLOCKED_TAG_NAMES})[^>]*\\/?>`,
  'gi',
);
const TAG_PATTERN = /<\/?([a-zA-Z][\w-]*)([^>]*)>/g;


/**
 * Strip executable markup from rich text markdown HTML fragments.
 * Allows a conservative tag allowlist; removes events, scripts, and dangerous URIs.
 */
export function sanitizeRichText(input: string): string {
  if (!input) return '';

  // Blocked elements go first, and to a fixed point: removing the inner match of
  // `<scr<script>ipt>` leaves `<script>` behind, so one pass can create what it just deleted.
  // This terminates because the replacement only ever deletes characters, so each pass that
  // changes anything strictly shortens the string.
  //
  // This pass exists to drop the *contents* of a script or style element, not to police
  // attributes. Attributes are handled below by rebuilding every surviving tag from an
  // allowlist, which is a parse rather than a blocklist, and is why the event-handler and
  // dangerous-URI regexes that used to run here are gone: `RICH_TEXT_ALLOWED_ATTRS` permits
  // href, title and rel on `<a>` and nothing on anything else, so onclick, formaction,
  // xlink:href and a javascript: href are all dropped by not being on the list. A blocklist
  // layered over an allowlist adds no safety and cannot be reasoned about, since it only ever
  // catches what the allowlist has already refused.
  let sanitized = input;
  let previous: string;
  do {
    previous = sanitized;
    sanitized = sanitized.replace(BLOCKED_TAG_PATTERN, '');
  } while (sanitized !== previous);

  sanitized = sanitized.replace(TAG_PATTERN, (match, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    const isClosing = match.startsWith('</');

    if (!RICH_TEXT_ALLOWED_TAGS.has(tag)) {
      return '';
    }

    if (isClosing) {
      return `</${tag}>`;
    }

    const attrs = sanitizeAttributes(tag, rawAttrs ?? '');
    return attrs.length > 0 ? `<${tag}${attrs}>` : `<${tag}>`;
  });

  return sanitized;
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const allowedForTag = RICH_TEXT_ALLOWED_ATTRS[tag] ?? RICH_TEXT_ALLOWED_ATTRS['*'];
  const attrPattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*(['"])(.*?)\2/g;
  const parts: string[] = [];

  for (const match of rawAttrs.matchAll(attrPattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[3] ?? '';
    if (!name || !allowedForTag?.has(name)) continue;
    if (name.startsWith('on')) continue;

    if (name === 'href' || name === 'src') {
      if (!isAllowedUri(value)) continue;
      parts.push(` ${name}="${escapeHtmlAttribute(value)}"`);
      continue;
    }

    parts.push(` ${name}="${escapeHtmlAttribute(value)}"`);
  }

  return parts.join('');
}

function isAllowedUri(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (!schemeMatch) return true;
  return RICH_TEXT_ALLOWED_URI_SCHEMES.has(schemeMatch[1]!.toLowerCase());
}

/** Alias for HTML fragment sanitization (same allowlist policy).  */
export const sanitizeHtml = sanitizeRichText;
