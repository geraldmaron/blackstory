/**
 * Public errata log seed data — reverse-chronological editorial changes wired to
 * methodology and corrections policy. Production replaces this with a live projection.
 * Fact-revision-derived URLs previously pointed at /facts; those routes were retired,
 * so affected URLs point at trust surfaces instead.
 */
import type { ErrataChangeType } from './domain-trust';

export type ErrataEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly changeType: ErrataChangeType;
  readonly headline: string;
  readonly summary: string;
  readonly affectedUrl?: string;
  readonly affectedFactId?: string;
};

const EDITORIAL_ERRATA: readonly ErrataEntry[] = [
  {
    id: 'errata_methodology_launch_2026',
    timestamp: '2026-07-17T12:00:00.000Z',
    changeType: 'editors_note',
    headline: 'Launched public methodology and errata surfaces',
    summary:
      'Published the full methodology page, corrections policy, and reverse-chronological errata log with RSS and JSON feeds.',
    affectedUrl: '/methodology',
  },
  {
    id: 'errata_dunbar_rename_precision_2026',
    timestamp: '2026-07-16T15:00:00.000Z',
    changeType: 'correction',
    headline: 'Dunbar rename statement clarified',
    summary:
      'Corrected short-statement wording so the 1916 rename is not read as a founding date. Full methodology and entity records remain the public sources of truth.',
    affectedUrl: '/entity/ent_dunbar_school_001',
    affectedFactId: 'BB-F-000003',
  },
  {
    id: 'errata_campus_rebuild_note_2026',
    timestamp: '2026-07-15T18:00:00.000Z',
    changeType: 'clarification',
    headline: 'Campus rebuild note expanded',
    summary:
      'Added clarification that institutional continuity of Dunbar does not imply continuity of the 1916 building fabric.',
    affectedUrl: '/corrections',
    affectedFactId: 'BB-F-000005',
  },
];

export const ERRATA_SEED: readonly ErrataEntry[] = [...EDITORIAL_ERRATA].sort((a, b) =>
  b.timestamp.localeCompare(a.timestamp),
);

export function listErrataEntries(): readonly ErrataEntry[] {
  return ERRATA_SEED;
}

export function getErrataEntry(id: string): ErrataEntry | undefined {
  return ERRATA_SEED.find((entry) => entry.id === id);
}
