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
    id: 'errata_langston_first_elected_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'John Mercer Langston House: not the first Black elected official',
    summary:
      'The record said Langston was "the first Black elected official in the United States." Alexander Twilight was elected to the Vermont legislature in 1836 and Wentworth Cheswill was elected in New Hampshire in 1768, both before Langston\u2019s 1855 election as a township clerk. It now calls him one of the earliest Black Americans elected to public office.',
  },
  {
    id: 'errata_howard_houston_training_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'Howard University: Charles Hamilton Houston trained at Harvard',
    summary:
      'The record said Howard\u2019s law school trained Charles Hamilton Houston. He earned his law degrees at Harvard and later led Howard\u2019s law school, where he trained Thurgood Marshall. An unsourced sentence about Howard anchoring a cluster of Reconstruction institutions was removed, and a claim that the cited page did not support was replaced with the sentence it does contain.',
  },
  {
    id: 'errata_first_baptist_beale_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'First Baptist Church on Beale Street: dates, sources and language',
    summary:
      'The record repeated a 1970 nomination\u2019s wording, including "Negro" in the archive\u2019s own voice. It also said a Black minister led the first prayer meetings, which no source we found states, placed Henderson\u2019s arrival and Grant\u2019s visit in Reconstruction, and dated Church Park to 1900. It now names Rev. Scott Keys, attributes the 1863 date to the nomination, dates Church Park to 1899 and no longer places Grant\u2019s visit in Reconstruction.',
  },
  {
    id: 'errata_drew_resignation_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'Charles Richard Drew House: why he left the plasma program',
    summary:
      'The record said Drew resigned in protest of segregating donated blood and helped reverse the military\u2019s policy. The National Library of Medicine\u2019s Drew papers find no evidence the policy was his reason for leaving, and his National Register nomination says the Army had already revoked the policy before he became a consultant. The record now states the protest account as disputed and gives his pilot-program dates.',
  },
  {
    id: 'errata_yazoo_hospital_first_2026',
    timestamp: '2026-11-08T20:00:00.000Z',
    changeType: 'correction',
    headline: 'Afro-American Sons and Daughters Hospital: not the first in Mississippi',
    summary:
      'The record called it the first hospital built in Mississippi to serve African Americans. The Colored King\u2019s Daughters Hospital in Greenville was built for Black patients in 1908. It also said the order gave free care to thousands until 1972. Care was a benefit for dues-paying members with limits, others paid fees, and Yazoo County ran it from 1967.',
  },
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
      'Corrected short-statement wording so the 1916 rename is not read as a founding date. The methodology and the place record stay the public sources of truth.',
    affectedUrl: '/place/paul-laurence-dunbar-high-school',
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
