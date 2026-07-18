
/**
 * Idempotent load/refresh CLI for the ACS 5-year collections (`acsCountyProfiles`,
 * `acsTractProfiles`) — the comparison layer beside `censusCountyDecades` (./load-cli.ts,
 * whose lane/provenance/idempotency notes all apply here).
 *
 * County: one API request. Tract: the API requires one request per state, so the tract
 * runner fans out over the distinct state FIPS codes OBSERVED IN THE COUNTY PULL (never a
 * hardcoded list — the dataset's own geography drives coverage), pacing requests with a
 * delay and asserting the variable dictionary once up front.
 *
 * Tract writes go through a per-state writer (`applyState`): the live implementation reads
 * the state's existing contentHashes with one projection query, then batch-writes only
 * created/updated docs (400 per batch) — ~85k docs would be far too slow one round-trip at
 * a time.
 *
 * Run directly with tsx:
 * CENSUS_API_KEY=... node --conditions development --import tsx \
 *   packages/firebase/src/demographics/acs-load-cli.ts --county --tract
 */
import {
  ACS5_2024_VINTAGE,
  assertAcsVintageDictionary,
  assertPublishedStatisticProvenance,
  buildAcsCountyProvenanceUrl,
  buildAcsTractProvenanceUrl,
  fetchAcsCountyProfiles,
  fetchAcsTractProfiles,
  sha256Json,
  type AcsProfileRow,
  type AcsVintage,
  type FetchLike,
} from '@blap/domain';
import { createServerFirebaseApp } from '../server.js';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import {
  acsCountyProfileId,
  acsCountyProfileSchema,
  acsTractProfileId,
  acsTractProfileSchema,
  type AcsCountyProfileDoc,
  type AcsTractProfileDoc,
} from './schema.js';

/** Tract boundary vintage for 2020s ACS releases (2020 tract geography). */
const ACS_TRACT_BOUNDARY_VINTAGE = '2020' as const;

export type AcsWriteOutcome = 'created' | 'updated' | 'unchanged';

export type AcsCountyWriter = {
  upsert(doc: AcsCountyProfileDoc): Promise<AcsWriteOutcome>;
};

/** Per-state tract writer: implementations own idempotency (compare contentHash) and
 * batching; they report how many docs each outcome bucket received. */
export type AcsTractStateWriter = {
  applyState(
    stateFips: string,
    docs: readonly AcsTractProfileDoc[],
  ): Promise<{ created: number; updated: number; unchanged: number }>;
};

export function buildAcsCountyProfileDoc(
  row: AcsProfileRow,
  vintage: AcsVintage,
  nowIso: string,
): AcsCountyProfileDoc {
  const sourceUrl = buildAcsCountyProvenanceUrl(vintage);
  const doc: AcsCountyProfileDoc = {
    id: acsCountyProfileId(row.geoid, vintage.vintage),
    fips5: row.geoid,
    stateFips: row.stateFips,
    countyFips: row.countyFips,
    name: row.name,
    vintage: vintage.vintage,
    estimates: row.values,
    suppressed: [...row.suppressed],
    source: vintage.sourceId,
    sourceUrl,
    retrievedAt: nowIso,
    contentHash: sha256Json({
      geoid: row.geoid,
      vintage: vintage.vintage,
      name: row.name,
      estimates: row.values,
      suppressed: [...row.suppressed],
      source: vintage.sourceId,
      sourceUrl,
    }).digest,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  assertPublishedStatisticProvenance(doc);
  return acsCountyProfileSchema.parse(doc);
}

export function buildAcsTractProfileDoc(
  row: AcsProfileRow,
  vintage: AcsVintage,
  nowIso: string,
): AcsTractProfileDoc {
  if (!row.tractCode) {
    throw new Error(`row ${row.geoid} has no tractCode — county row passed to tract builder`);
  }
  const sourceUrl = buildAcsTractProvenanceUrl(vintage, row.stateFips);
  const doc: AcsTractProfileDoc = {
    id: acsTractProfileId(row.geoid, vintage.vintage),
    geoid11: row.geoid,
    fips5: `${row.stateFips}${row.countyFips}`,
    stateFips: row.stateFips,
    countyFips: row.countyFips,
    tractCode: row.tractCode,
    tractVintage: ACS_TRACT_BOUNDARY_VINTAGE,
    name: row.name,
    vintage: vintage.vintage,
    estimates: row.values,
    suppressed: [...row.suppressed],
    source: vintage.sourceId,
    sourceUrl,
    retrievedAt: nowIso,
    contentHash: sha256Json({
      geoid: row.geoid,
      vintage: vintage.vintage,
      name: row.name,
      estimates: row.values,
      suppressed: [...row.suppressed],
      source: vintage.sourceId,
      sourceUrl,
    }).digest,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  assertPublishedStatisticProvenance(doc);
  return acsTractProfileSchema.parse(doc);
}

export type RunAcsCountyLoadOptions = {
  readonly writer: AcsCountyWriter;
  readonly vintage?: AcsVintage;
  readonly apiKey?: string;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => string;
};

export type RunAcsCountyLoadSummary = {
  readonly vintage: string;
  readonly fetched: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: readonly string[];
  /** Distinct state FIPS observed — the tract fan-out's coverage list. */
  readonly stateFipsSeen: readonly string[];
};

export async function runAcsCountyLoad(
  options: RunAcsCountyLoadOptions,
): Promise<RunAcsCountyLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const vintage = options.vintage ?? ACS5_2024_VINTAGE;
  const fetched = await fetchAcsCountyProfiles(vintage, {
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  const nowIso = now();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const stateFipsSeen = new Set<string>();
  for (const row of fetched.rows) {
    stateFipsSeen.add(row.stateFips);
    const outcome = await options.writer.upsert(buildAcsCountyProfileDoc(row, vintage, nowIso));
    if (outcome === 'created') created += 1;
    else if (outcome === 'updated') updated += 1;
    else unchanged += 1;
  }

  return {
    vintage: vintage.vintage,
    fetched: fetched.rows.length,
    created,
    updated,
    unchanged,
    rejected: fetched.rejected,
    stateFipsSeen: [...stateFipsSeen].sort(),
  };
}

export type RunAcsTractLoadOptions = {
  readonly writer: AcsTractStateWriter;
  readonly stateFipsList: readonly string[];
  readonly vintage?: AcsVintage;
  readonly apiKey?: string;
  readonly fetchImpl?: FetchLike;
  readonly now?: () => string;
  /** Pause between state requests (default 500ms; 0 in tests). */
  readonly delayMs?: number;
  /** Retries per state on fetch failure (default 2). */
  readonly retries?: number;
};

export type RunAcsTractStateSummary = {
  readonly stateFips: string;
  readonly fetched: number;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: readonly string[];
};

export type RunAcsTractLoadSummary = {
  readonly vintage: string;
  readonly states: readonly RunAcsTractStateSummary[];
  readonly failedStates: readonly { readonly stateFips: string; readonly error: string }[];
  readonly totalDocs: number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runAcsTractLoad(
  options: RunAcsTractLoadOptions,
): Promise<RunAcsTractLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const vintage = options.vintage ?? ACS5_2024_VINTAGE;
  const delayMs = options.delayMs ?? 500;
  const retries = options.retries ?? 2;
  const fetchOptions = {
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  };

  // One dictionary assertion for the whole fan-out — not one per state.
  await assertAcsVintageDictionary(vintage, fetchOptions);

  const states: RunAcsTractStateSummary[] = [];
  const failedStates: { stateFips: string; error: string }[] = [];
  let totalDocs = 0;

  for (const stateFips of options.stateFipsList) {
    let lastError: unknown;
    let succeeded = false;
    for (let attempt = 0; attempt <= retries && !succeeded; attempt += 1) {
      try {
        if (attempt > 0 && delayMs > 0) await sleep(delayMs * attempt);
        const fetched = await fetchAcsTractProfiles(vintage, stateFips, {
          ...fetchOptions,
          assertDictionary: false,
        });
        const nowIso = now();
        const docs = fetched.rows.map((row) => buildAcsTractProfileDoc(row, vintage, nowIso));
        const outcome = await options.writer.applyState(stateFips, docs);
        states.push({
          stateFips,
          fetched: fetched.rows.length,
          ...outcome,
          rejected: fetched.rejected,
        });
        totalDocs += docs.length;
        succeeded = true;
      } catch (error) {
        lastError = error;
      }
    }
    if (!succeeded) {
      failedStates.push({
        stateFips,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
    }
    if (delayMs > 0) await sleep(delayMs);
  }

  return { vintage: vintage.vintage, states, failedStates, totalDocs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { getFirestore } = await import('firebase-admin/firestore');

  const args = process.argv.slice(2);
  const doCounty = args.includes('--county') || args.length === 0;
  const doTract = args.includes('--tract');

  const { app } = createServerFirebaseApp(process.env);
  const firestore = getFirestore(app);
  const apiKey = process.env.CENSUS_API_KEY;

  const countyCollection = firestore.collection(FIRESTORE_ROOT.acsCountyProfiles);
  const tractCollection = firestore.collection(FIRESTORE_ROOT.acsTractProfiles);

  const countyWriter: AcsCountyWriter = {
    async upsert(doc) {
      const snapshot = await countyCollection.doc(doc.id).get();
      if (snapshot.exists) {
        const existing = acsCountyProfileSchema.parse(snapshot.data());
        if (existing.contentHash === doc.contentHash) return 'unchanged';
        await countyCollection.doc(doc.id).set({ ...doc, createdAt: existing.createdAt });
        return 'updated';
      }
      await countyCollection.doc(doc.id).set(doc);
      return 'created';
    },
  };

  const BATCH_LIMIT = 400;
  const tractWriter: AcsTractStateWriter = {
    async applyState(stateFips, docs) {
      // One projection query per state resolves every existing doc's contentHash cheaply.
      const existingSnapshot = await tractCollection
        .where('stateFips', '==', stateFips)
        .select('contentHash', 'createdAt')
        .get();
      const existing = new Map(
        existingSnapshot.docs.map((d) => [
          d.id,
          d.data() as { contentHash?: string; createdAt?: string },
        ]),
      );

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let batch = firestore.batch();
      let batched = 0;
      const commitBatch = async () => {
        if (batched > 0) await batch.commit();
        batch = firestore.batch();
        batched = 0;
      };

      for (const doc of docs) {
        const prior = existing.get(doc.id);
        if (prior?.contentHash === doc.contentHash) {
          unchanged += 1;
          continue;
        }
        const toWrite = prior?.createdAt ? { ...doc, createdAt: prior.createdAt } : doc;
        batch.set(tractCollection.doc(doc.id), toWrite);
        batched += 1;
        if (prior) updated += 1;
        else created += 1;
        if (batched >= BATCH_LIMIT) await commitBatch();
      }
      await commitBatch();
      return { created, updated, unchanged };
    },
  };

  let stateFipsList: readonly string[] = [];
  if (doCounty) {
    const countySummary = await runAcsCountyLoad({
      writer: countyWriter,
      ...(apiKey ? { apiKey } : {}),
    });
    console.log(JSON.stringify(countySummary, null, 2));
    stateFipsList = countySummary.stateFipsSeen;
  }

  if (doTract) {
    if (stateFipsList.length === 0) {
      // Tract-only run: derive coverage from a fresh county fetch without writing.
      const vintage = ACS5_2024_VINTAGE;
      const fetched = await fetchAcsCountyProfiles(vintage, apiKey ? { apiKey } : {});
      stateFipsList = [...new Set(fetched.rows.map((row) => row.stateFips))].sort();
    }
    const tractSummary = await runAcsTractLoad({
      writer: tractWriter,
      stateFipsList,
      ...(apiKey ? { apiKey } : {}),
    });
    console.log(JSON.stringify(tractSummary, null, 2));
  }
}
