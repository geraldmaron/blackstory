/**
 * Idempotent loader for `censusCountyHistoricalDecades` — historical county race from NHGIS
 * (1790–1960, one doc per NHGIS county per decade). Mirrors `./national-load-cli.ts`: every
 * dependency is injectable so `runNhgisCountyLoad` is unit-testable, and only the
 * `if (import.meta.url ...)` block touches real Firestore.
 *
 * Acquisition is the NHGIS API v2 async extract flow — see docs/runbooks/nhgis-county-historical-load.md.
 * The operator submits extracts (via @repo/domain's submitNhgisExtract), downloads
 * and unzips them into a directory; this loader reads one CSV per decade from there, parses it with
 * the verified `parseNhgisCountyRaceCsv` adapter, and upserts docs. Boundaries are keyed by NHGIS
 * `gisJoin` on each decade's historical geography (`boundaryVersion` = `nhgis-<decade>`); the
 * combination rules already refuse to difference across boundary versions, so cross-vintage county
 * deltas stay blocked until an NHGIS crosswalk lands.
 *
 * Serving: this collection is client-read CLOSED (~45k docs). The public map reads the bounded
 * static artifact `buildNhgisCountyDecadeArtifact` emits, never this collection.
 */
import { readdirSync, readFileSync } from 'node:fs';
import {
  assertPublishedStatisticProvenance,
  getExternalDataSource,
  hashUtf8,
  sha256Json,
  parseNhgisCountyRaceCsv,
  NHGIS_DECADE_RACE_TABLES,
  type NhgisCountyRaceRow,
} from '@repo/domain';
import { createServerFirebaseApp } from '../server.js';
import { FIRESTORE_ROOT } from '../firestore/paths.js';
import {
  censusCountyHistoricalDecadeId,
  censusCountyHistoricalDecadeSchema,
  parseCensusCountyHistoricalDecadeDoc,
  type CensusCountyHistoricalDecadeDoc,
} from './schema.js';

export const NHGIS_SOURCE_ID = 'nhgis-county-race';

export type CensusCountyHistoricalWriteOutcome = 'created' | 'updated' | 'unchanged';

export type CensusCountyHistoricalWriter = {
  upsert(doc: CensusCountyHistoricalDecadeDoc): Promise<CensusCountyHistoricalWriteOutcome>;
};

/** Stable fields the per-row contentHash covers (excludes retrieval/write timestamps). */
export function nhgisCountyContentFields(
  row: NhgisCountyRaceRow,
  source: string,
  sourceUrl: string,
): Record<string, string | number> {
  return {
    gisJoin: row.gisJoin,
    decade: row.decade,
    black: row.black,
    ...(row.blackFree !== null ? { blackFree: row.blackFree } : {}),
    ...(row.blackEnslaved !== null ? { blackEnslaved: row.blackEnslaved } : {}),
    ...(row.white !== null ? { white: row.white } : {}),
    source,
    sourceUrl,
  };
}

export function buildNhgisCountyHistoricalDoc(input: {
  readonly row: NhgisCountyRaceRow;
  readonly source: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly datasetChecksum: string;
  readonly nowIso: string;
}): CensusCountyHistoricalDecadeDoc {
  const { row, source, sourceUrl, license, datasetChecksum, nowIso } = input;
  const doc: CensusCountyHistoricalDecadeDoc = {
    id: censusCountyHistoricalDecadeId(row.gisJoin, row.decade),
    gisJoin: row.gisJoin,
    decade: row.decade,
    boundaryVersion: row.boundaryVersion,
    stateName: row.stateName,
    countyName: row.countyName,
    stateCode: row.stateCode,
    countyCode: row.countyCode,
    black: row.black,
    ...(row.blackFree !== null ? { blackFree: row.blackFree } : {}),
    ...(row.blackEnslaved !== null ? { blackEnslaved: row.blackEnslaved } : {}),
    ...(row.white !== null ? { white: row.white } : {}),
    source,
    sourceUrl,
    datasetChecksum,
    license,
    retrievedAt: nowIso,
    contentHash: sha256Json(nhgisCountyContentFields(row, source, sourceUrl)).digest,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  assertPublishedStatisticProvenance(doc);
  return censusCountyHistoricalDecadeSchema.parse(doc);
}

export type RunNhgisCountyLoadOptions = {
  readonly writer: CensusCountyHistoricalWriter;
  /** Returns the NHGIS county CSV text for a decade (operator-downloaded + unzipped). */
  readonly readCsvForDecade: (decade: string) => string;
  readonly decades?: readonly string[];
  readonly now?: () => string;
};

export type RunNhgisCountyLoadSummary = {
  readonly decades: readonly {
    readonly decade: string;
    readonly counties: number;
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
  }[];
  readonly totalWritten: number;
};

export async function runNhgisCountyLoad(
  options: RunNhgisCountyLoadOptions,
): Promise<RunNhgisCountyLoadSummary> {
  const now = options.now ?? (() => new Date().toISOString());
  const decades = options.decades ?? NHGIS_DECADE_RACE_TABLES.map((t) => t.decade);

  const source = getExternalDataSource(NHGIS_SOURCE_ID);
  if (!source) {
    throw new Error(`External source ${NHGIS_SOURCE_ID} is not registered`);
  }
  // NHGIS is attribution-required (not public domain); that IS a valid ingest lane, but must
  // never be silently treated as unrestricted — the license string travels on every doc.
  if (source.license.verdict !== 'attribution-required') {
    throw new Error(`Unexpected NHGIS license verdict: ${source.license.verdict}`);
  }

  const summaries: Array<RunNhgisCountyLoadSummary['decades'][number]> = [];
  let totalWritten = 0;

  for (const decade of decades) {
    const csvText = options.readCsvForDecade(decade);
    const rows = parseNhgisCountyRaceCsv(csvText, decade);
    const datasetChecksum = hashUtf8(csvText).digest;
    const nowIso = now();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const row of rows) {
      const doc = buildNhgisCountyHistoricalDoc({
        row,
        source: source.id,
        sourceUrl: source.homepageUrl, // human citation (nhgis.org), never a raw extract URL
        license: source.license.name,
        datasetChecksum,
        nowIso,
      });
      const outcome = await options.writer.upsert(doc);
      if (outcome === 'created') created += 1;
      else if (outcome === 'updated') updated += 1;
      else unchanged += 1;
    }
    totalWritten += created + updated;
    summaries.push({ decade, counties: rows.length, created, updated, unchanged });
  }

  return { decades: summaries, totalWritten };
}

// ---- Static map artifact (bounded; the public surface reads THIS, never the collection) ----

export type NhgisCountyArtifactRow = {
  readonly gisJoin: string;
  readonly black: number;
  readonly blackFree?: number;
  readonly blackEnslaved?: number;
};

export type NhgisCountyDecadeArtifact = {
  readonly source: string;
  readonly attribution: string;
  readonly decades: readonly string[];
  /** Per-decade boundary vintage key (NHGIS historical geography). */
  readonly boundaryVersions: Readonly<Record<string, string>>;
  readonly note: string;
  /** decade → county rows keyed by NHGIS gisJoin. */
  readonly byDecade: Readonly<Record<string, readonly NhgisCountyArtifactRow[]>>;
};

/**
 * Builds the bounded static artifact from loaded docs — decade → [{gisJoin, black, …}] plus
 * attribution and the boundary-vintage note. Deterministic (sorted); no timestamps.
 */
export function buildNhgisCountyDecadeArtifact(
  docs: readonly CensusCountyHistoricalDecadeDoc[],
): NhgisCountyDecadeArtifact {
  const byDecade: Record<string, NhgisCountyArtifactRow[]> = {};
  const boundaryVersions: Record<string, string> = {};
  for (const doc of docs) {
    (byDecade[doc.decade] ??= []).push({
      gisJoin: doc.gisJoin,
      black: doc.black,
      ...(doc.blackFree !== undefined ? { blackFree: doc.blackFree } : {}),
      ...(doc.blackEnslaved !== undefined ? { blackEnslaved: doc.blackEnslaved } : {}),
    });
    boundaryVersions[doc.decade] = doc.boundaryVersion;
  }
  for (const decade of Object.keys(byDecade)) {
    byDecade[decade]!.sort((a, b) => a.gisJoin.localeCompare(b.gisJoin));
  }
  return {
    source: NHGIS_SOURCE_ID,
    attribution:
      'Steven Manson et al., IPUMS National Historical Geographic Information System, NHGIS (nhgis.org).',
    decades: Object.keys(byDecade).sort(),
    boundaryVersions,
    note:
      'County counts on each decade’s historical NHGIS boundaries (gisJoin). Not modern FIPS; ' +
      'cross-decade change requires an NHGIS crosswalk. County sums run slightly below national ' +
      'totals by the “population not in any county” residual.',
    byDecade,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.env.NHGIS_DATA_DIR;
  if (!dir) {
    throw new Error(
      'Set NHGIS_DATA_DIR to a directory of unzipped NHGIS *_<decade>_county.csv files',
    );
  }
  const findCsv = (decade: string): string => {
    const match = readdirSync(dir).find((f) => f.endsWith(`_${decade}_county.csv`));
    if (!match) throw new Error(`No NHGIS county CSV for decade ${decade} in ${dir}`);
    return readFileSync(`${dir}/${match}`, 'latin1');
  };

  const { getFirestore } = await import('firebase-admin/firestore');
  const { app } = createServerFirebaseApp(process.env);
  const firestore = getFirestore(app);
  const collection = firestore.collection(FIRESTORE_ROOT.censusCountyHistoricalDecades);

  const writer: CensusCountyHistoricalWriter = {
    async upsert(doc) {
      const snapshot = await collection.doc(doc.id).get();
      if (snapshot.exists) {
        const existing = parseCensusCountyHistoricalDecadeDoc(snapshot.data());
        if (existing.contentHash === doc.contentHash) return 'unchanged';
        await collection.doc(doc.id).set({ ...doc, createdAt: existing.createdAt });
        return 'updated';
      }
      await collection.doc(doc.id).set(doc);
      return 'created';
    },
  };

  const summary = await runNhgisCountyLoad({ writer, readCsvForDecade: findCsv });
  console.log(JSON.stringify(summary, null, 2));
}
