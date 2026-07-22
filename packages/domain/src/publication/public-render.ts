/**
 * Public render helpers: resolve editorial prose-link markup to plain display text
 * before search cards, metadata, claims, and other surfaces that do not run LinkedProse.
 * Release projections keep markup on summary/historicalContext for entity-page link resolution.
 */
import { stripProseEntityLinks } from '../editorial/prose-links.js';

/** Strips `[[entityId|Label]]` to Label (or entityId when no label). Never emits brackets. */
export function sanitizePublicProseText(text: string): string {
  if (!text.includes('[[')) {
    return text;
  }
  return stripProseEntityLinks(text);
}

/** Sanitizes optional prose fields for plain-text public surfaces. */
export function sanitizePublicProseField(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  return sanitizePublicProseText(text);
}
