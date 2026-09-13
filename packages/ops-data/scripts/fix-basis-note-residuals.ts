/**
 * repo-lod22 — the two basis-note residuals left after repo-15slz fixed the composer.
 *
 * PASS 1 gives a subject back to the `source states` claims whose object is a subjectless
 * fragment, so their notability-basis note stops reading as one.
 *
 * PASS 2 refreshes the handful of stored notes that still carry a predicate lead the builder now
 * drops ("First to In 1949, when the U.S. mission in Liberia..."). These are NOT a composer bug:
 * the builder already spells them correctly. They are stale stored copies that
 * `resync-notability-basis.ts` reports as "already correct" and declines to touch, because its S2
 * step matches a published record to a recomputed one on an EXACT evidenceIds set, and these rows
 * were published when the builder grouped that predicate's claims differently. Matching on
 * evidence OVERLAP instead finds them. That gap is the resync's to close for the whole catalog
 * (repo-4qlmt); this script only applies the same S2 test, unchanged, to two named records.
 *
 * THE DEFECT. `buildNotabilityBasisNote` joins a predicate lead to the claim object. For the
 * `source states` predicate that yields "Source states <object>", which is correct English when
 * the object carries its own subject ("Source states Alonzo Herndon, who was born into slavery in
 * 1858...") and broken when it does not:
 *
 *   "Source states was the only hospital serving West Palm Beach's African American community."
 *
 * repo-15slz already fixed the composer's general rule; this is not that bug wearing the same
 * clothes. No composition rule can make a sentence out of "was the only hospital" — keeping the
 * prefix gives the line above, dropping it gives something worse. The object needs a subject, so
 * this is a data repair on the claim, which is what the bead ruled.
 *
 * WHY THE NOTE IS WRITTEN TOO, rather than left to the resync. `resolveNotabilityBasisForRow`
 * refuses to overwrite a stored note unless `notesAreSameSentence` holds. Inserting a subject
 * makes the builder's note a DIFFERENT sentence from the stored one, so the resync would
 * (correctly) decline and the repaired claim would sit behind a stale note. The note here is not
 * hand-composed either: this script calls `buildReleaseNotabilityBasis` on the repaired claims and
 * takes its spelling, so it cannot drift from the builder.
 *
 * THE SUBJECT IS NOT MECHANICALLY `displayName`. It is whatever the source is talking about. Two
 * cases that a sweep would have got wrong:
 *   - Evans, Dr. Matilda A., House — "was the first African-American woman licensed to practice
 *     medicine in South Carolina" is Dr. Evans, not her house. A house cannot be licensed.
 *   - Community Hospital — the object opens "founded in 1927, is historically significant...", so
 *     the subject needs a comma after it (`mode: 'comma'`), not a bare join.
 *
 * TWO OF THE EIGHTEEN ARE DELIBERATELY NOT HERE. Their subject is not recoverable from the record:
 *   - nrhp-black-heritage-02001290 "helped to secure funds for the purchase of land..." — the
 *     subject is whoever raised the money, not the school later built on that land.
 *   - nrhp-black-heritage-95000855 "led from the Natchez slave markets at the Forks of the Road
 *     to Zion Chapel African Methodist Episcopal Church Episcopal Church..." — the subject is a
 *     route, not the historic district, and the object also carries a duplicated phrase.
 * Both need their nomination read. Guessing a subject onto a cited claim would publish a
 * fabrication, which is worse than the fragment. They stay open on repo-lod22.
 *
 * The repaired text is DERIVED from the live object rather than transcribed into this file, so a
 * copy error cannot silently rewrite a published claim. The only hand-written full replacement is
 * the one record whose stored object is itself truncated mid-clause.
 *
 * Writes `projection` only. The eleven derived columns are GENERATED from it (repo-m14ko), so a
 * column write would now be refused by Postgres and is not attempted.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-basis-note-residuals.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_BASIS_NOTE_RESIDUALS_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-basis-note-residuals.ts
 */
import { buildReleaseNotabilityBasis } from '@repo/domain';
import type { ReleaseClaimProjection, ReleaseSourceEntity } from '@repo/domain';
import pg from 'pg';
import { notesAreSameSentence } from './lib/notability-basis-resync.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';

const DRY_RUN = process.env['DRY_RUN'] !== '0';
const APPLY = process.env['FIX_BASIS_NOTE_RESIDUALS_APPLY'] === '1';

/**
 * The fragment shape this script is allowed to touch: an object opening with a bare finite verb
 * and therefore carrying no subject of its own. A record whose object no longer matches is skipped
 * rather than rewritten.
 */
const BARE_VERB =
  /^(was|were|is|are|had|has|have|became|served|led|founded|died|remained|operated|received|won|helped|worked|opened|began|provided|built)\b/;

type Repair = {
  readonly entityId: string;
  readonly claimId: string;
  /** The subject to restore. Joined to the live object; never pasted over it. */
  readonly subject: string;
  /** 'join' -> "<subject> <object>"; 'comma' -> "<subject>, <object>". */
  readonly mode?: 'join' | 'comma';
  /** Full replacement, used only where the stored object is itself damaged. */
  readonly replacement?: string;
};

const REPAIRS: readonly Repair[] = [
  {
    entityId: 'nrhp-black-heritage-00000006',
    claimId: 'claim_nrhp-black-heritage-00000006_03',
    subject: "the Well'sbuilt Hotel",
  },
  {
    entityId: 'nrhp-black-heritage-00000260',
    claimId: 'claim_nrhp-black-heritage-00000260_04',
    subject: 'the Nathan and Mary (Polly) Johnson Properties',
    // The stored object is truncated mid-clause ("...but it is the only one of Douglass"). The
    // dangling half is dropped rather than completed from guesswork; what remains is supported.
    replacement:
      'the Nathan and Mary (Polly) Johnson Properties was the first home of the famed fugitive Frederick Douglass after his 1838 escape from slavery.',
  },
  {
    entityId: 'nrhp-black-heritage-00001459',
    claimId: 'claim_nrhp-black-heritage-00001459_03',
    subject: 'the Medgar Evers House',
  },
  {
    entityId: 'nrhp-black-heritage-00001675',
    claimId: 'claim_nrhp-black-heritage-00001675_03',
    subject: 'Pine Ridge Hospital',
  },
  {
    entityId: 'nrhp-black-heritage-01001171',
    claimId: 'claim_nrhp-black-heritage-01001171_03',
    subject: 'Prairie Mission',
  },
  {
    entityId: 'nrhp-black-heritage-02000973',
    claimId: 'claim_nrhp-black-heritage-02000973_03',
    subject: 'St. Paul Baptist Church and Cemetery',
  },
  {
    entityId: 'nrhp-black-heritage-02001219',
    claimId: 'claim_nrhp-black-heritage-02001219_03',
    subject: 'Main High School',
  },
  {
    entityId: 'nrhp-black-heritage-03000925',
    claimId: 'claim_nrhp-black-heritage-03000925_03',
    subject: 'the Freewill Baptist Church-Peoples Baptist Church-New Hope Church',
  },
  {
    entityId: 'nrhp-black-heritage-04000224',
    claimId: 'claim_nrhp-black-heritage-04000224_03',
    subject: 'Community Hospital',
    mode: 'comma',
  },
  {
    entityId: 'nrhp-black-heritage-100000896',
    claimId: 'claim_nrhp-black-heritage-100000896_03',
    subject: 'Little River High School',
  },
  {
    entityId: 'nrhp-black-heritage-100003317',
    claimId: 'claim_nrhp-black-heritage-100003317_03',
    // The subject is Dr. Evans herself, not the house the record is about.
    subject: 'Dr. Matilda A. Evans',
  },
  {
    entityId: 'nrhp-black-heritage-100007568',
    claimId: 'claim_nrhp-black-heritage-100007568_04',
    subject: 'Scott Zion Baptist Church',
  },
  {
    entityId: 'nrhp-black-heritage-100008135',
    claimId: 'claim_nrhp-black-heritage-100008135_03',
    subject: 'Ryan Hall Elementary School',
  },
  {
    entityId: 'nrhp-black-heritage-77000788',
    claimId: 'claim_nrhp-black-heritage-77000788_03',
    subject: 'Ayer Hall',
  },
  {
    entityId: 'nrhp-black-heritage-94000602',
    claimId: 'claim_nrhp-black-heritage-94000602_03',
    subject: 'Seaside School',
  },
  {
    entityId: 'nrhp-black-heritage-96000915',
    claimId: 'claim_nrhp-black-heritage-96000915_03',
    subject: 'Behavior Cemetery',
  },
  /*
   * These two were held back on the first run because their subject is not the record. Both are
   * now settled from the cited nomination itself rather than guessed, so the replacement is the
   * source's own sentence:
   *
   *   02001290, NRHP 02001290_text: "Captain Risley, while serving in the Brunswick Freedmen's
   *   office, helped to secure funds for the purchase of land in Town Commons to be used as the
   *   site of the first public African-American school in Brunswick." The subject is Captain
   *   Risley — the Freedmen's Bureau officer the school is named for — not the school, which did
   *   not exist yet and was built on the land he helped buy.
   *
   *   95000855, NRHP 95000855_text: "...St. Catherine Street, the eighteenth-century road and
   *   later city street that led from the Natchez slave markets at the Forks of the Road to Zion
   *   Chapel African Methodist Episcopal Church..." The subject is the street, not the historic
   *   district. The doubled "Episcopal Church Episcopal Church" is a defect in the NOMINATION's
   *   own text (it appears there verbatim, and the same document renders the church differently
   *   200 lines earlier); it is corrected here rather than propagated, since a `source states`
   *   claim is reported speech, not a verbatim quotation.
   */
  {
    entityId: 'nrhp-black-heritage-02001290',
    claimId: 'claim_nrhp-black-heritage-02001290_04',
    subject: 'Captain Risley',
    replacement:
      "Captain Risley, while serving in the Brunswick Freedmen's office, helped to secure funds for the purchase of land in Town Commons to be used as the site of the first public African-American school in Brunswick.",
  },
  {
    entityId: 'nrhp-black-heritage-95000855',
    claimId: 'claim_nrhp-black-heritage-95000855_03',
    subject: 'St. Catherine Street',
    replacement:
      'St. Catherine Street, the eighteenth-century road and later city street, led from the Natchez slave markets at the Forks of the Road to Zion Chapel African Methodist Episcopal Church, the church of Hiram Revels, the first African-American to serve in the United States Congress.',
  },
];

/**
 * Pass 2. Records whose stored note is the builder's note with a dropped predicate lead still on
 * the front. Deliberately an explicit list rather than a catalog-wide sweep: widening the resync's
 * matching is a shared-library change with 1,605 candidate rows behind it and belongs on its own
 * bead, not on this one.
 *
 * Mott Motors/Plymouth Theater is knowingly NOT here. Its note reads the same way ("Documented
 * site 1928 automobile dealership designed by Upman & Adams...") but the builder still produces
 * exactly that: the object is a noun phrase, not a sentence of its own, so `objectIsSelfStanding`
 * correctly keeps the lead. Nothing is stale there, and rewriting it would be an editorial change
 * to a working rule.
 */
const REFRESH_IDS: readonly string[] = ['ent_edward_dudley_001', 'ent_macon_bolling_allen_001'];

type BasisRecord = { criterion: string; note: string; evidenceIds: string[] };

type Row = {
  entity_id: string;
  kind: string;
  display_name: string;
  summary: string | null;
  claims: ReleaseClaimProjection[];
  basis: BasisRecord[] | null;
};

function repairedObject(repair: Repair, object: string): string {
  if (repair.replacement !== undefined) return repair.replacement;
  return repair.mode === 'comma' ? `${repair.subject}, ${object}` : `${repair.subject} ${object}`;
}

/**
 * Applies the resync's own S2 test — `notesAreSameSentence`, imported, not reimplemented — to the
 * named rows, matching a published basis record to a recomputed one on shared evidence rather
 * than on an identical evidence set.
 */
async function refreshStaleNotes(client: pg.PoolClient): Promise<number> {
  const { rows } = await client.query<Row>(
    `SELECT e.entity_id,
            e.projection ->> 'kind'        AS kind,
            e.projection ->> 'displayName' AS display_name,
            e.projection ->> 'summary'     AS summary,
            COALESCE(e.projection -> 'claims', '[]'::jsonb)          AS claims,
            COALESCE(e.projection -> 'notabilityBasis', '[]'::jsonb) AS basis
       FROM bb_public.release_entities e, bb_public.v_active_release_id a
      WHERE e.release_id = a.release_id
        AND e.entity_id = ANY($1::text[])`,
    [REFRESH_IDS],
  );
  let changed = 0;
  for (const row of rows) {
    const entry = {
      kind: row.kind,
      displayName: row.display_name,
      summary: row.summary ?? '',
    } as unknown as ReleaseSourceEntity;
    const rebuilt = buildReleaseNotabilityBasis(entry, row.claims);
    const published = row.basis ?? [];
    let touched = false;
    const nextBasis = published.map((record) => {
      const candidate = rebuilt.find(
        (other) =>
          other.criterion === record.criterion &&
          other.evidenceIds.some((id) => record.evidenceIds.includes(id)),
      );
      if (candidate === undefined || candidate.note === record.note) return record;
      const evidencedClaim = row.claims.find((claim) => record.evidenceIds.includes(claim.id));
      const droppedLead = evidencedClaim?.predicate.replaceAll('_', ' ').trim() ?? '';
      if (!notesAreSameSentence(record.note, candidate.note, row.display_name, droppedLead)) {
        return record;
      }
      console.log(`\n${row.entity_id}  (${row.display_name})`);
      console.log(`  before  ${record.note}`);
      console.log(`  after   ${candidate.note}`);
      touched = true;
      return { ...record, note: candidate.note };
    });
    if (!touched) {
      console.log(`SKIP ${row.entity_id}: no stored note is the builder's with a lead on it.`);
      continue;
    }
    changed += 1;
    if (DRY_RUN || !APPLY) continue;
    await client.query(
      `UPDATE bb_public.release_entities
          SET projection = jsonb_set(projection, '{notabilityBasis}', $2::jsonb, true)
        WHERE entity_id = $1
          AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
      [row.entity_id, JSON.stringify(nextBasis)],
    );
  }
  return changed;
}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await pool.connect();
  let planned = 0;
  let skipped = 0;
  try {
    const { rows } = await client.query<Row>(
      `SELECT e.entity_id,
              e.projection ->> 'kind'        AS kind,
              e.projection ->> 'displayName' AS display_name,
              e.projection ->> 'summary'     AS summary,
              COALESCE(e.projection -> 'claims', '[]'::jsonb)          AS claims,
              COALESCE(e.projection -> 'notabilityBasis', '[]'::jsonb) AS basis
         FROM bb_public.release_entities e, bb_public.v_active_release_id a
        WHERE e.release_id = a.release_id
          AND e.entity_id = ANY($1::text[])`,
      [REPAIRS.map((repair) => repair.entityId)],
    );
    const byId = new Map(rows.map((row) => [row.entity_id, row]));

    for (const repair of REPAIRS) {
      const row = byId.get(repair.entityId);
      if (!row) {
        console.log(`SKIP ${repair.entityId}: not in the active release.`);
        skipped += 1;
        continue;
      }
      const claim = row.claims.find((candidate) => candidate.id === repair.claimId);
      if (!claim) {
        console.log(`SKIP ${repair.entityId}: claim ${repair.claimId} is gone.`);
        skipped += 1;
        continue;
      }
      const object = String(claim.object ?? '');
      if (!BARE_VERB.test(object)) {
        console.log(`SKIP ${repair.entityId}: object is no longer a bare-verb fragment.`);
        skipped += 1;
        continue;
      }

      const nextClaims = row.claims.map((candidate) =>
        candidate.id === repair.claimId
          ? { ...candidate, object: repairedObject(repair, object) }
          : candidate,
      );
      const entry = {
        kind: row.kind,
        displayName: row.display_name,
        summary: row.summary ?? '',
      } as unknown as ReleaseSourceEntity;
      // The builder is the single source of the note's spelling; nothing is composed by hand here.
      const rebuilt = buildReleaseNotabilityBasis(entry, nextClaims);
      const published = row.basis ?? [];
      /*
       * Match on the repaired CLAIM, not on the whole evidence set. Several of these rows were
       * published when the builder grouped predicates differently — Well'sbuilt Hotel's stored
       * record cites claims _03 and _04 where the builder now emits _03 alone — so an exact
       * evidenceIds comparison finds nothing and the repair silently does no work. Converging
       * that grouping is the resync's job, not this script's: only the note changes here, and
       * `evidenceIds` is left exactly as published.
       */
      const rebuiltForClaim = rebuilt.find((other) => other.evidenceIds.includes(repair.claimId));
      const beforeNote = published.find((record) =>
        record.evidenceIds.includes(repair.claimId),
      )?.note;
      if (rebuiltForClaim === undefined || beforeNote === undefined) {
        console.log(`SKIP ${repair.entityId}: no basis record cites ${repair.claimId}.`);
        skipped += 1;
        continue;
      }
      const afterNote = rebuiltForClaim.note;
      if (afterNote === beforeNote) {
        console.log(`SKIP ${repair.entityId}: the builder produced the same note — check by hand.`);
        skipped += 1;
        continue;
      }
      const nextBasis = published.map((record) =>
        record.evidenceIds.includes(repair.claimId) ? { ...record, note: afterNote } : record,
      );

      planned += 1;
      console.log(`\n${repair.entityId}  (${row.display_name})`);
      console.log(`  before  ${beforeNote ?? '(none)'}`);
      console.log(`  after   ${afterNote}`);

      if (DRY_RUN || !APPLY) continue;
      await client.query(
        `UPDATE bb_public.release_entities
            SET projection = jsonb_set(
                  jsonb_set(projection, '{claims}', $2::jsonb, true),
                  '{notabilityBasis}', $3::jsonb, true
                )
          WHERE entity_id = $1
            AND release_id = (SELECT release_id FROM bb_public.v_active_release_id)`,
        [repair.entityId, JSON.stringify(nextClaims), JSON.stringify(nextBasis)],
      );
    }

    console.log('\n--- pass 2: stale notes carrying a dropped predicate lead ---');
    const refreshed = await refreshStaleNotes(client);

    console.log(`\nPlanned: ${planned + refreshed}   Skipped: ${skipped}`);
    if (DRY_RUN || !APPLY) {
      console.log('Dry run — nothing written. Set DRY_RUN=0 FIX_BASIS_NOTE_RESIDUALS_APPLY=1.');
      return;
    }
    console.log(`APPLIED: ${planned + refreshed} record(s).`);
    remindToRepublishCatalogArtifacts(planned + refreshed);
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
