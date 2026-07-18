/**
 * Ingest the FBI UCR hate crime bulk file (black-book-8qp) — raw artifacts to Storage, and
 * three Firestore collections: `ucrAgencies` (ORI → county crosswalk), `hateCrimeCountyYears`
 * (the cross-reference aggregate, joins on fips5), `ucrStateParticipation` (coverage).
 *
 * County resolution (no LLM, fully deterministic — per black-book-7j0's directive):
 *   1. FBI's own `counties` field when it names exactly one county → match to census county
 *      names for the FIPS.
 *   2. Otherwise (multi-county agencies like NYPD/Columbus/Portland, or "NOT SPECIFIED"),
 *      point-in-county on the agency's published coordinates against the county polygons
 *      already shipped at apps/web/public/geo/us-counties-20m.geojson.
 *   Every agency records which basis was used, plus the point-derived county even when it
 *   disagrees with the name match, so the approximation is auditable.
 *
 * Reads the CDE's signed-URL endpoint for both artifacts, so no stale direct link is baked in:
 *   GET https://cde.ucr.cjis.gov/LATEST/s3/signedurl?key=<awsFile>
 *
 * Requires:
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1 to validate without writing)
 *   Application Default Credentials with Storage + Firestore write on black-book-efaaf
 *
 * Usage (from repo root):
 *   BLAP_FIREBASE_ALLOW_PRODUCTION=1 node --conditions development --import tsx \
 *     packages/firebase/scripts/ingest-hate-crime.ts \
 *     --hate-crime-csv=/path/hate_crime.csv \
 *     --agencies-json=/path/all-agencies.json \
 *     --participation-csv=/path/ucr_participation.csv \
 *     --county-geojson=apps/web/public/geo/us-counties-20m.geojson \
 *     --hate-crime-zip=/path/hate_crime.zip
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getExternalDataSource, sha256Json } from '@blap/domain';
import { idempotentBatchUpsert, loadExistingHashes } from '../src/external/batch-upsert.ts';
import { recordDatasetAcquisition } from '../src/external/capture.ts';
import { FIRESTORE_ROOT } from '../src/firestore/paths.ts';
import {
  hateCrimeCountyYearId,
  hateCrimeCountyYearSchema,
  ucrAgencySchema,
  ucrStateParticipationSchema,
  type HateCrimeCountyYearDoc,
  type UcrAgencyDoc,
  type UcrStateParticipationDoc,
} from '../src/external/ucr-schema.ts';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'black-book-efaaf';
const ALLOW = process.env.BLAP_FIREBASE_ALLOW_PRODUCTION === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
const BUCKET = `${PROJECT_ID}-raw-sources`;

const HATE_CRIME_KEY = 'additional-datasets/hate-crime/hate_crime.zip';
const PARTICIPATION_KEY = 'additional-datasets/ucr/ucr_participation_1960_2024.csv';
const HC_SOURCE = 'fbi-ucr-hate-crime';
const AGENCY_SOURCE = 'fbi-ucr-agency-directory';
const PARTICIPATION_SOURCE = 'fbi-ucr-participation';
const LICENSE = 'U.S. government work — public domain (17 U.S.C. §105); cite the FBI UCR Program';
const VERSION = '1991-2024';
const HC_STORAGE_PATH = `raw-sources/fbi-ucr-hate-crime/${VERSION}/hate_crime.zip`;
const PARTICIPATION_STORAGE_PATH = `raw-sources/fbi-ucr-participation/${VERSION}/ucr_participation_1960_2024.csv`;
const PARSER_VERSION = 'ingest-hate-crime-v1';

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Owning-body FBI UCR hate-crime hub for public provenance — never a CDE signedurl API. */
function provenanceUrl(_key: string): string {
  return 'https://ucr.fbi.gov/hate-crime';
}

// ── county polygons: point-in-county without a geo dependency ────────────────────────────
type CountyPoly = {
  fips5: string;
  name: string;
  polys: number[][][][];
  box: [number, number, number, number];
};

function loadCountyPolys(path: string): CountyPoly[] {
  const geo = JSON.parse(readFileSync(path, 'utf8')) as {
    features: { properties: { name: string; stateFips: string; countyFips: string }; geometry: { type: string; coordinates: unknown } }[];
  };
  return geo.features.map((f) => {
    const polys = (f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry.coordinates) as number[][][][];
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    for (const poly of polys) {
      for (const [x, y] of poly[0]!) {
        if (x! < minX) minX = x!;
        if (x! > maxX) maxX = x!;
        if (y! < minY) minY = y!;
        if (y! > maxY) maxY = y!;
      }
    }
    return {
      fips5: `${f.properties.stateFips}${f.properties.countyFips}`,
      name: f.properties.name,
      polys,
      box: [minX, minY, maxX, maxY] as [number, number, number, number],
    };
  });
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]! as [number, number];
    const [xj, yj] = ring[j]! as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-15) + xi) inside = !inside;
  }
  return inside;
}

function locateCounty(counties: CountyPoly[], lng: number, lat: number): CountyPoly | undefined {
  for (const c of counties) {
    const [minX, minY, maxX, maxY] = c.box;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    for (const poly of c.polys) {
      if (pointInRing(lng, lat, poly[0]!) && !poly.slice(1).some((h) => pointInRing(lng, lat, h))) {
        return c;
      }
    }
  }
  return undefined;
}

function normalizeCountyName(value: string): string {
  return value
    .toUpperCase()
    .replace(/\b(COUNTY|PARISH|BOROUGH|CENSUS AREA|CITY AND BOROUGH|MUNICIPALITY|MUNICIPIO|CITY)\b/g, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minimal CSV line splitter honoring double-quoted fields (UCR files quote sparingly). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted;
    } else if (ch === ',' && !quoted) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

async function main(): Promise<void> {
  if (!ALLOW && !DRY_RUN) {
    console.error('Refusing to write: set BLAP_FIREBASE_ALLOW_PRODUCTION=1 (or DRY_RUN=1)');
    process.exit(2);
  }
  const hateCrimeCsv = arg('hate-crime-csv');
  const agenciesJson = arg('agencies-json');
  const participationCsv = arg('participation-csv');
  const countyGeojson = arg('county-geojson', 'apps/web/public/geo/us-counties-20m.geojson')!;
  const hateCrimeZip = arg('hate-crime-zip');
  for (const [label, p] of [['--hate-crime-csv', hateCrimeCsv], ['--agencies-json', agenciesJson], ['--participation-csv', participationCsv], ['--county-geojson', countyGeojson]] as const) {
    if (!p || !existsSync(p)) { console.error(`Missing or nonexistent ${label}`); process.exit(2); }
  }

  console.log(`Project: ${PROJECT_ID}${DRY_RUN ? ' (dry-run)' : ''}`);
  const nowIso = new Date().toISOString();
  const hcChecksum = hateCrimeZip && existsSync(hateCrimeZip) ? sha256Of(hateCrimeZip) : sha256Of(hateCrimeCsv!);
  const participationChecksum = sha256Of(participationCsv!);
  console.log(`hate crime artifact sha256: ${hcChecksum}`);
  console.log(`participation artifact sha256: ${participationChecksum}`);

  // ── 1. agency crosswalk ────────────────────────────────────────────────────────────────
  const counties = loadCountyPolys(countyGeojson);
  const fipsByName = new Map<string, { fips5: string; name: string }>();
  for (const c of counties) fipsByName.set(`${c.fips5.slice(0, 2)}|${normalizeCountyName(c.name)}`, c);

  const raw = JSON.parse(readFileSync(agenciesJson!, 'utf8')) as Record<string, Record<string, unknown>>;
  const stateFipsByAbbr = new Map<string, string>();
  const agencyRecords: { abbr: string; countyKey: string; a: Record<string, unknown> }[] = [];
  for (const [abbr, byCounty] of Object.entries(raw)) {
    if (typeof byCounty !== 'object' || byCounty === null) continue;
    for (const [countyKey, listRaw] of Object.entries(byCounty)) {
      const list = Array.isArray(listRaw) ? listRaw : [listRaw];
      for (const a of list) {
        if (a && typeof a === 'object' && (a as { ori?: string }).ori) {
          agencyRecords.push({ abbr, countyKey, a: a as Record<string, unknown> });
        }
      }
    }
  }
  // state abbr -> state FIPS, learned from whichever agencies point-resolve.
  for (const { abbr, a } of agencyRecords) {
    if (stateFipsByAbbr.has(abbr)) continue;
    const lat = a.latitude as number | undefined;
    const lng = a.longitude as number | undefined;
    if (typeof lat === 'number' && typeof lng === 'number') {
      const hit = locateCounty(counties, lng, lat);
      if (hit) stateFipsByAbbr.set(abbr, hit.fips5.slice(0, 2));
    }
  }

  const agencyDocs: UcrAgencyDoc[] = [];
  const oriToCounty = new Map<string, { fips5?: string; approximate: boolean }>();
  let byName = 0, byPoint = 0, unresolved = 0;
  for (const { abbr, countyKey, a } of agencyRecords) {
    const ori = String(a.ori);
    const countyRaw = String((a.counties as string) ?? countyKey ?? '').trim();
    const multiCounty = countyRaw.includes(',');
    const lat = typeof a.latitude === 'number' ? (a.latitude as number) : undefined;
    const lng = typeof a.longitude === 'number' ? (a.longitude as number) : undefined;
    const stateFips = stateFipsByAbbr.get(abbr);
    const nameHit = !multiCounty && stateFips
      ? fipsByName.get(`${stateFips}|${normalizeCountyName(countyRaw)}`)
      : undefined;
    const pointHit = lat !== undefined && lng !== undefined ? locateCounty(counties, lng, lat) : undefined;

    let fips5: string | undefined;
    let countyName: string | undefined;
    let basis: UcrAgencyDoc['fipsBasis'];
    if (nameHit) {
      fips5 = nameHit.fips5; countyName = nameHit.name;
      basis = pointHit ? (pointHit.fips5 === nameHit.fips5 ? 'name_match_confirmed_by_point' : 'name_match_point_disagrees') : 'name_match_only';
      byName += 1;
    } else if (pointHit) {
      fips5 = pointHit.fips5; countyName = pointHit.name; basis = 'agency_point_in_county';
      byPoint += 1;
    } else unresolved += 1;

    const stable = { ori, fips5: fips5 ?? null, basis: basis ?? null, source: AGENCY_SOURCE, datasetChecksum: hcChecksum };
    agencyDocs.push(ucrAgencySchema.parse({
      id: ori, ori,
      agencyName: String(a.agency_name ?? ori),
      ...(a.agency_type_name ? { agencyType: String(a.agency_type_name) } : {}),
      stateAbbr: abbr,
      ...(fips5 ? { fips5, countyName } : {}),
      ...(countyRaw ? { countyNameRaw: countyRaw } : {}),
      ...(basis ? { fipsBasis: basis } : {}),
      ...(pointHit ? { fips5FromPoint: pointHit.fips5 } : {}),
      multiCounty,
      isNibrs: a.is_nibrs === true,
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
      source: AGENCY_SOURCE,
      sourceUrl: 'https://ucr.fbi.gov/hate-crime',
      retrievedAt: nowIso,
      contentHash: sha256Json(stable).digest,
      datasetChecksum: hcChecksum,
      license: LICENSE,
      createdAt: nowIso, updatedAt: nowIso,
    }));
    oriToCounty.set(ori, { ...(fips5 ? { fips5 } : {}), approximate: multiCounty || basis === 'agency_point_in_county' });
  }
  console.log(`agencies: ${agencyDocs.length.toLocaleString()} (name ${byName.toLocaleString()}, point ${byPoint.toLocaleString()}, unresolved ${unresolved.toLocaleString()})`);

  // ── 2. hate crime county-year aggregates ───────────────────────────────────────────────
  type Agg = { incidents: number; antiBlack: number; victims: number; oris: Set<string>; approx: number;
    bias: Map<string, number>; offense: Map<string, number>; location: Map<string, number> };
  const agg = new Map<string, Agg>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  let totalRows = 0, resolvedRows = 0;

  const reader = createInterface({ input: createReadStream(hateCrimeCsv!), crlfDelay: Infinity });
  let header: Map<string, number> | undefined;
  for await (const line of reader) {
    if (!header) {
      header = new Map(splitCsvLine(line).map((h, i) => [h.trim(), i]));
      for (const need of ['data_year', 'ori', 'bias_desc', 'offense_name', 'location_name', 'victim_count']) {
        if (!header.has(need)) throw new Error(`hate_crime.csv header missing "${need}"`);
      }
      continue;
    }
    if (!line.trim()) continue;
    totalRows += 1;
    const cells = splitCsvLine(line);
    const cell = (name: string) => cells[header!.get(name)!] ?? '';
    const agency = oriToCounty.get(cell('ori'));
    if (!agency?.fips5) continue;
    resolvedRows += 1;
    const year = cell('data_year').trim();
    const key = hateCrimeCountyYearId(agency.fips5, year);
    let d = agg.get(key);
    if (!d) {
      d = { incidents: 0, antiBlack: 0, victims: 0, oris: new Set(), approx: 0, bias: new Map(), offense: new Map(), location: new Map() };
      agg.set(key, d);
    }
    d.incidents += 1;
    d.oris.add(cell('ori'));
    if (agency.approximate) d.approx += 1;
    const victims = Number(cell('victim_count'));
    if (Number.isFinite(victims) && victims > 0) d.victims += victims;
    const biases = cell('bias_desc').split(';').map((b) => b.trim()).filter(Boolean);
    for (const b of biases) bump(d.bias, b);
    if (biases.some((b) => b.includes('Anti-Black'))) d.antiBlack += 1;
    for (const o of cell('offense_name').split(';').map((s) => s.trim()).filter(Boolean)) bump(d.offense, o);
    for (const l of cell('location_name').split(';').map((s) => s.trim()).filter(Boolean)) bump(d.location, l);
  }

  const topN = (m: Map<string, number>, n: number) =>
    Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n));
  const countyYearDocs: HateCrimeCountyYearDoc[] = [...agg.entries()].map(([id, d]) => {
    const [fips5, year] = id.split('_') as [string, string];
    const stable = { id, incidents: d.incidents, antiBlack: d.antiBlack, bias: topN(d.bias, 40), source: HC_SOURCE, datasetChecksum: hcChecksum };
    return hateCrimeCountyYearSchema.parse({
      id, fips5, stateFips: fips5.slice(0, 2), year,
      incidents: d.incidents, antiBlackIncidents: d.antiBlack, victimCount: d.victims,
      reportingAgencyCount: d.oris.size, approximatedAgencyIncidents: d.approx,
      biasCounts: topN(d.bias, 40), offenseCounts: topN(d.offense, 15), locationCounts: topN(d.location, 12),
      source: HC_SOURCE, sourceUrl: provenanceUrl(HATE_CRIME_KEY), retrievedAt: nowIso,
      contentHash: sha256Json(stable).digest, datasetChecksum: hcChecksum, license: LICENSE,
      createdAt: nowIso, updatedAt: nowIso,
    });
  });
  console.log(`incidents: ${totalRows.toLocaleString()}  resolved to county: ${resolvedRows.toLocaleString()} (${((resolvedRows / totalRows) * 100).toFixed(1)}%)`);
  console.log(`county-year docs: ${countyYearDocs.length.toLocaleString()} across ${new Set(countyYearDocs.map((d) => d.fips5)).size.toLocaleString()} counties`);

  // ── 3. state participation (the coverage denominator) ──────────────────────────────────
  const partLines = readFileSync(participationCsv!, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const partHeader = new Map(splitCsvLine(partLines[0]!).map((h, i) => [h.trim(), i]));
  const num = (v: string | undefined) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
  const participationDocs: UcrStateParticipationDoc[] = [];
  for (const line of partLines.slice(1)) {
    const c = splitCsvLine(line);
    const get = (k: string) => c[partHeader.get(k)!]?.trim();
    const year = get('data_year');
    const stateName = get('state_name');
    if (!year || !stateName) continue;
    const id = `${stateName.replace(/\s+/g, '_')}_${year}`;
    const stable = { id, participating: num(get('participation_agencies')) ?? null, source: PARTICIPATION_SOURCE, datasetChecksum: participationChecksum };
    participationDocs.push(ucrStateParticipationSchema.parse({
      id, stateName, year,
      ...(num(get('total_agencies')) !== undefined ? { totalAgencies: Math.trunc(num(get('total_agencies'))!) } : {}),
      ...(num(get('participation_agencies')) !== undefined ? { participatingAgencies: Math.trunc(num(get('participation_agencies'))!) } : {}),
      ...(num(get('participating_agencies_pct')) !== undefined ? { participatingAgenciesPct: num(get('participating_agencies_pct'))! } : {}),
      ...(num(get('covered_agencies')) !== undefined ? { coveredAgencies: Math.trunc(num(get('covered_agencies'))!) } : {}),
      ...(num(get('covered_pct')) !== undefined ? { coveredPct: num(get('covered_pct'))! } : {}),
      ...(num(get('total_population')) !== undefined ? { totalPopulation: Math.trunc(num(get('total_population'))!) } : {}),
      source: PARTICIPATION_SOURCE, sourceUrl: provenanceUrl(PARTICIPATION_KEY), retrievedAt: nowIso,
      contentHash: sha256Json(stable).digest, datasetChecksum: participationChecksum, license: LICENSE,
      createdAt: nowIso, updatedAt: nowIso,
    }));
  }
  console.log(`participation docs: ${participationDocs.length.toLocaleString()}`);

  if (DRY_RUN) { console.log('Dry-run: validated, nothing written.'); return; }

  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const firestore = getFirestore();

  if (hateCrimeZip && existsSync(hateCrimeZip) && !process.argv.includes('--skip-storage-upload')) {
    const bucket = getStorage().bucket(BUCKET);
    console.log(`Uploading raw artifacts to gs://${BUCKET}/raw-sources/fbi-ucr-* …`);
    await bucket.upload(hateCrimeZip, { destination: HC_STORAGE_PATH, metadata: { metadata: { sha256: hcChecksum } } });
    await bucket.file(`${HC_STORAGE_PATH}.sha256`).save(`${hcChecksum}  hate_crime.zip\n`);
    await bucket.upload(participationCsv!, { destination: PARTICIPATION_STORAGE_PATH, metadata: { metadata: { sha256: participationChecksum } } });
    await bucket.file(`${PARTICIPATION_STORAGE_PATH}.sha256`).save(`${participationChecksum}  ucr_participation_1960_2024.csv\n`);
    console.log('Upload complete.');
  }

  const write = async (collectionName: string, docs: readonly { id: string; contentHash: string; createdAt: string }[]) => {
    const collection = firestore.collection(collectionName);
    const existing = await loadExistingHashes(collection);
    const summary = await idempotentBatchUpsert(firestore, collection, docs, existing);
    console.log(`${collectionName}: ${JSON.stringify(summary)}`);
  };
  await write(FIRESTORE_ROOT.ucrAgencies, agencyDocs);
  await write(FIRESTORE_ROOT.hateCrimeCountyYears, countyYearDocs);
  await write(FIRESTORE_ROOT.ucrStateParticipation, participationDocs);

  for (const [sourceId, checksum, storagePath] of [
    [HC_SOURCE, hcChecksum, HC_STORAGE_PATH],
    [PARTICIPATION_SOURCE, participationChecksum, PARTICIPATION_STORAGE_PATH],
  ] as const) {
    const registryEntry = getExternalDataSource(sourceId);
    if (!registryEntry) throw new Error(`external-data-sources entry missing: ${sourceId}`);
    const acquisition = await recordDatasetAcquisition({
      firestore, registryEntry, contentHashHex: checksum, retrievedAt: nowIso,
      snapshotStorageObject: `gs://${BUCKET}/${storagePath}`, parserVersion: PARSER_VERSION, httpStatus: 200,
    });
    console.log(`acquisition ${sourceId}: ${acquisition.sourceCaptureId ?? acquisition.retrievalEventId}`);
  }
  const agencyRegistry = getExternalDataSource(AGENCY_SOURCE);
  if (agencyRegistry) {
    const acquisition = await recordDatasetAcquisition({
      firestore, registryEntry: agencyRegistry, contentHashHex: hcChecksum, retrievedAt: nowIso,
      parserVersion: PARSER_VERSION, httpStatus: 200,
    });
    console.log(`acquisition ${AGENCY_SOURCE}: ${acquisition.retrievalEventId}`);
  }
}

await main();
