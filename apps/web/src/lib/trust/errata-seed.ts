/**
 * Public errata log seed data (BB-088) — reverse-chronological editorial changes wired to BB-086
 * fact revisions and BB-055 corrections policy. Production replaces this with a live projection.
 */
import { listSeedFacts } from '../../data/facts-seed.js';
import {
  errataTypeFromFactRevisionChangeType,
  type ErrataChangeType,
} from './domain-trust.js';

function buildFactPath(id: string, slug: string): string {
  return `/facts/${id}/${slug}`;
}

export type ErrataEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly changeType: ErrataChangeType;
  readonly headline: string;
  readonly summary: string;
  readonly affectedUrl?: string;
  readonly affectedFactId?: string;
};

function factRevisionErrataEntries(): ErrataEntry[] {
  const entries: ErrataEntry[] = [];
  for (const fact of listSeedFacts()) {
    for (const revision of fact.revisions) {
      if (revision.changeType === 'update' && revision.revisionNumber === 1) {
        continue;
      }
      entries.push({
        id: `errata_${fact.id}_rev_${revision.revisionNumber}`,
        timestamp: revision.timestamp,
        changeType: errataTypeFromFactRevisionChangeType(revision.changeType),
        headline: `${fact.shortStatement} — ${revision.summary}`,
        summary: revision.summary,
        affectedUrl: buildFactPath(fact.id, fact.slug),
        affectedFactId: fact.id,
      });
    }
  }
  return entries;
}

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
];

export const ERRATA_SEED: readonly ErrataEntry[] = [
  ...EDITORIAL_ERRATA,
  ...factRevisionErrataEntries(),
].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

export function listErrataEntries(): readonly ErrataEntry[] {
  return ERRATA_SEED;
}

export function getErrataEntry(id: string): ErrataEntry | undefined {
  return ERRATA_SEED.find((entry) => entry.id === id);
}
