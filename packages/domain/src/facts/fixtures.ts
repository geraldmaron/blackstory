/**
 * Internal test fixtures for the BB-086 fact registry — NOT re-exported from `./index.ts`, same
 * convention as `../graph/fixtures.ts` and `../map/fixtures.ts` (imported by relative path from
 * this directory's own `*.test.ts` files only).
 */
import { asFactId } from './ids.js';
import type { FactCitation } from './citation.js';
import type { FactRecord } from './record.js';

export function buildFixtureCitation(overrides: Partial<FactCitation> = {}): FactCitation {
  return {
    csl: {
      id: 'csl-mia-boycott',
      type: 'webpage',
      title: 'Montgomery Bus Boycott chronology',
      URL: 'https://example.gov/mia-chronology',
    },
    sourceClass: 'primary',
    role: 'supports',
    excerpt: 'Rosa Parks was arrested on December 1, 1955, for refusing to give up her bus seat.',
    archivedUrl: 'https://web.archive.org/web/20260101000000/https://example.gov/mia-chronology',
    archivedAt: '2026-01-01T00:00:00.000Z',
    accessedAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  };
}

export function buildFixtureFact(overrides: Partial<FactRecord> = {}): FactRecord {
  return {
    id: asFactId('BB-F-000001'),
    slug: 'rosa-parks-arrested-december-1-1955',
    statement:
      'Rosa Parks was arrested in Montgomery, Alabama on December 1, 1955, for refusing to give up her seat to a white passenger.',
    shortStatement: 'Rosa Parks arrested, Dec. 1, 1955',
    claimType: 'event',
    subjects: [{ entityId: 'ent_rosa_parks', kind: 'person' }],
    geo: { lat: 32.3792, lng: -86.3077, geoPrecision: 'locality' },
    when: { validFrom: '1955-12-01', datePrecision: 'day' },
    qualifiers: [],
    counterClaims: [],
    relatedFacts: [],
    provenance: { researchedBy: 'researcher-1', method: 'primary-source-review' },
    status: 'published',
    confidence: 'established',
    citations: [buildFixtureCitation()],
    revisions: [
      {
        revisionNumber: 1,
        timestamp: '2026-01-05T00:00:00.000Z',
        agent: { id: 'user-1', type: 'user' },
        changeType: 'update',
        summary: 'Initial publication.',
        diff: [],
      },
    ],
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    ...overrides,
  };
}
