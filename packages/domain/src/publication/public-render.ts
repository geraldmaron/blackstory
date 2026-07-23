/**
 * Public render helpers: resolve editorial prose-link markup to plain display text
 * before search cards, metadata, claims, and other surfaces that do not run LinkedProse.
 * Release projections keep markup on summary/historicalContext for entity-page link resolution.
 *
 * Implementation lives in `../editorial/prose-links` so web clients can import a crypto-free
 * path (`@repo/domain/editorial`) without evaluating `publication/index` (node:crypto).
 */
export {
  sanitizePublicProseField,
  sanitizePublicProseText,
} from '../editorial/prose-links.js';
