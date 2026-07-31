/**
 * Lane B / repo-bmmo — deterministic NRHP African American heritage roster.
 *
 * Stages National Register of Historic Places listings whose NPS-assigned
 * "Area of Significance" includes Black / Ethnic Heritage-Black into
 * bb_research.landscape_candidates (lane='nrhp-black-heritage'). No LLM and
 * no search-UI crawling (the bb_research.cases junk came from crawling
 * NPGallery's search UI) — this reads the National Register program's own
 * published dataset:
 *
 *   1. https://www.nps.gov/subjects/nationalregister/data-downloads.htm →
 *      latest national-register-listed_<date>.xlsx (the official full list of
 *      listed properties, with Area of Significance per row).
 *   2. NPS ArcGIS REST layer cultural_resources/nrhp_locations/MapServer/0,
 *      joined by NRIS reference number, for lat/lng (WGS84).
 *
 * The xlsx is parsed with `unzip -p` + streaming-safe regex over the two
 * inner XML parts (no spreadsheet dependency). Rows are keyed by explicit
 * cell references (r="A2" etc.), so blank cells cannot shift columns.
 *
 * Filter: Status = Listed AND Area of Significance matches \bBLACK\b (the
 * NPS vocabulary spells it "ETHNIC HERITAGE-BLACK" or plain "BLACK"; no
 * other vocabulary term contains the word). "(Boundary Increase)" /
 * "(Additional Documentation)" / "(Boundary Decrease)" re-listings of the
 * same property collapse onto the base listing.
 *
 * canonical_url: the row's own External Link (National Archives catalog)
 * when present, else the NPGallery NRIS asset page
 * https://npgallery.nps.gov/AssetDetail/NRIS/<refnum>. Both hosts are
 * federal (.gov). Because the lane is ~2,700 rows, per-row fetch
 * verification is replaced by a sampled reachability check (default 25
 * rows, all must return 200) recorded in the report. CAVEAT (verified
 * 2026-07-28): both target hosts are JS-rendered SPAs, and NPGallery
 * AssetDetail returns 200 even for bogus refnums — so 200 here proves
 * reachability, not content. Content-level identity rests on the refnums /
 * archive links being copied verbatim from NPS's own dataset (never
 * constructed from guesses), on ArcGIS-layer presence for geo-matched rows,
 * and on the promotion path, whose corroboration step fetches each page
 * with name-presence checks before anything can publish.
 *
 * Default is dry-run. Production writes require:
 *   DRY_RUN=0 NRHP_BLACK_HERITAGE_APPLY=1 DATABASE_URL=postgresql://...
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/scrape-nrhp-black-heritage-roster.ts
 */
import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '../../..');
const CACHE_DIR = join(REPO_ROOT, '.cache/landscape-intake');
const REPORT_DIR = CACHE_DIR;

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.NRHP_BLACK_HERITAGE_APPLY === '1';
const SAMPLE_SIZE = Number(process.env.NRHP_URL_SAMPLE ?? '25');

const DOWNLOADS_PAGE = 'https://www.nps.gov/subjects/nationalregister/data-downloads.htm';
const ARCGIS_POINTS_LAYER =
  'https://mapservices.nps.gov/arcgis/rest/services/cultural_resources/nrhp_locations/MapServer/0/query';
const SOURCE_PROGRAM_ID = 'us-nps-nrhp-listed-ethnic-heritage-black';
const SOURCE_PROGRAM_NAME =
  'National Park Service — National Register of Historic Places listed-properties dataset, Area of Significance: Black';
const LANE = 'nrhp-black-heritage';
const RUN_LANE = 'nrhp';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

export function unescapeXml(text: string): string {
  return text
    .replace(/&(?:amp|lt|gt|quot|apos);/gu, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#x([0-9a-f]+);/giu, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/gu, (_, dec: string) => String.fromCodePoint(Number(dec)));
}

/** Pure — parses xl/sharedStrings.xml into the ordered string table. */
export function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siPattern = /<si>([\s\S]*?)<\/si>/gu;
  let si: RegExpExecArray | null;
  while ((si = siPattern.exec(xml)) !== null) {
    const parts: string[] = [];
    const tPattern = /<t[^>]*>([\s\S]*?)<\/t>/gu;
    let t: RegExpExecArray | null;
    while ((t = tPattern.exec(si[1]!)) !== null) parts.push(unescapeXml(t[1]!));
    strings.push(parts.join(''));
  }
  return strings;
}

type SheetRow = Readonly<Record<string, string>>;

/** Pure — parses sheet XML into rows keyed by column letter (blank-safe). */
export function parseSheetRows(xml: string, sharedStrings: readonly string[]): SheetRow[] {
  const rows: SheetRow[] = [];
  const rowPattern = /<row[^>]*>([\s\S]*?)<\/row>/gu;
  const cellPattern = /<c\s+([^>]*?)\/?>(?:(?:<v>([\s\S]*?)<\/v>)?(?:<\/c>)?)?/gu;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const cells: Record<string, string> = {};
    let cellMatch: RegExpExecArray | null;
    cellPattern.lastIndex = 0;
    while ((cellMatch = cellPattern.exec(rowMatch[1]!)) !== null) {
      const attrs = cellMatch[1]!;
      const ref = /r="([A-Z]+)\d+"/u.exec(attrs)?.[1];
      if (!ref) continue;
      const isShared = /t="s"/u.test(attrs);
      const raw = cellMatch[2];
      if (raw === undefined) continue;
      cells[ref] = isShared ? (sharedStrings[Number(raw)] ?? '') : unescapeXml(raw);
    }
    rows.push(cells);
  }
  return rows;
}

const RELISTING_PAREN =
  /\s*\(+\s*(?:boundary\s+(?:increase|decrease|expansion)|additional\s+documentation|amendment)[^()]*\)+/giu;
const RELISTING_BARE =
  /\s+(?:boundary\s+(?:increase|decrease|expansion)(?:\s+and\s+additional\s+documentation)?|and\s+additional\s+documentation|additional\s+documentation)\s*$/iu;

export function baseListingName(name: string): string {
  return name
    .replace(RELISTING_PAREN, ' ')
    .replace(RELISTING_BARE, '')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

export function isRelistingName(name: string): boolean {
  return baseListingName(name) !== name.trim();
}

export function normalizeNameForDiff(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function titleCase(word: string): string {
  return word
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

type Listing = {
  readonly refnum: string;
  readonly displayName: string;
  readonly state: string;
  readonly county: string;
  readonly city: string;
  readonly areaOfSignificance: string;
  readonly category: string;
  readonly listedDateSerial: string | null;
  readonly restrictedAddress: boolean;
  readonly canonicalUrl: string;
  readonly externalLink: string | null;
  lat: number | null;
  lng: number | null;
};

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'user-agent': BROWSER_UA, accept: 'application/json', ...(init?.headers ?? {}) },
        redirect: 'follow',
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
  return null;
}

/**
 * The basename of a remote path, with anything that could steer a write stripped out.
 *
 * The NPS download link is scraped, so it is remote input choosing a filename. Taking the last
 * segment is not enough on its own: `..` is a valid last segment, and so is a name full of path
 * separators once decoded. This keeps word characters, dots and dashes, refuses a name that is
 * all dots, and caps the length.
 */
function safeCacheFilename(remotePath: string): string {
  const base = remotePath.split('/').pop() ?? '';
  const cleaned = base.replace(/[^\w.-]/gu, '_').slice(0, 128);
  if (cleaned.length === 0 || /^\.+$/u.test(cleaned)) {
    throw new Error(`refusing unsafe download filename: ${JSON.stringify(base)}`);
  }
  return cleaned;
}

/**
 * A report filename built only from characters we chose. `generatedAt` reaches this point after a
 * network round trip, so CodeQL sees remote input deciding a write path
 * (js/http-to-file-access); pinning the shape makes the constraint explicit rather than implied
 * by the timestamp's format.
 */
function safeReportFilename(prefix: string, stamp: string): string {
  const cleaned = stamp.replace(/[^\w-]/gu, '-').slice(0, 64);
  return `${prefix}-${cleaned}.json`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');

  // 1. Locate + download the latest listed-properties xlsx.
  const downloadsHtml = await (
    await fetch(DOWNLOADS_PAGE, { headers: { 'user-agent': BROWSER_UA } })
  ).text();
  const xlsxPath = /href="(\/subjects\/nationalregister\/upload\/national-register-listed_[\d]+\.xlsx)"/u.exec(
    downloadsHtml,
  )?.[1];
  if (!xlsxPath) throw new Error('could not find national-register-listed_*.xlsx link on data-downloads page');
  const xlsxUrl = `https://www.nps.gov${xlsxPath}`;
  mkdirSync(CACHE_DIR, { recursive: true });
  // The cache filename comes from a link on a page we fetched, so it is remote input deciding
  // where this process writes (CodeQL js/http-to-file-access). `safeCacheFilename` keeps the
  // basename and nothing else, so a link of `../../../etc/cron.d/x` cannot escape CACHE_DIR.
  const localXlsx = join(CACHE_DIR, safeCacheFilename(xlsxPath));
  // Written with wx, not existsSync-then-write. The check-then-act pair is a race: the file can
  // appear between the two, and on a shared cache directory that is someone else's file being
  // clobbered (CodeQL js/file-system-race). EEXIST is the answer to "already cached".
  let cached = false;
  try {
    const handle = openSync(localXlsx, 'wx');
    try {
      console.log(`Downloading ${xlsxUrl}`);
      const res = await fetch(xlsxUrl, { headers: { 'user-agent': BROWSER_UA } });
      if (!res.ok) throw new Error(`xlsx download failed: ${res.status}`);
      writeFileSync(handle, Buffer.from(await res.arrayBuffer()));
    } finally {
      closeSync(handle);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    cached = true;
  }
  if (cached) {
    console.log(`Using cached ${localXlsx}`);
  }

  // 2. Parse the two inner XML parts.
  const maxBuffer = 512 * 1024 * 1024;
  const sharedStrings = parseSharedStrings(
    execFileSync('unzip', ['-p', localXlsx, 'xl/sharedStrings.xml'], { maxBuffer }).toString('utf8'),
  );
  const rows = parseSheetRows(
    execFileSync('unzip', ['-p', localXlsx, 'xl/worksheets/sheet1.xml'], { maxBuffer }).toString('utf8'),
    sharedStrings,
  );
  const header = rows[0];
  if (!header) throw new Error('empty sheet');
  const colOf = (label: string): string => {
    const entry = Object.entries(header).find(([, v]) => v.trim().toLowerCase() === label.toLowerCase());
    if (!entry) throw new Error(`header column not found: ${label} (have: ${Object.values(header).join(', ')})`);
    return entry[0];
  };
  const COL = {
    refnum: colOf('Ref#'),
    name: colOf('Property Name'),
    state: colOf('State'),
    county: colOf('County'),
    city: colOf('City'),
    status: colOf('Status'),
    requestType: colOf('Request Type'),
    restricted: colOf('Restricted Address'),
    area: colOf('Area of Significance'),
    category: colOf('Category of Property'),
    externalLink: colOf('External Link'),
    listedDate: colOf('Listed Date'),
  };

  // 3. Filter to listed properties with Black area of significance.
  const blackWord = /\bBLACK\b/u;
  const filtered = rows.slice(1).filter((row) => {
    const status = row[COL.status]?.trim().toLowerCase();
    const area = row[COL.area] ?? '';
    return status === 'listed' && blackWord.test(area.toUpperCase());
  });
  console.log(`Dataset rows: ${rows.length - 1}. Listed + Black significance: ${filtered.length}.`);

  // 4. Collapse boundary-increase / additional-documentation re-listings.
  const byBaseKey = new Map<string, SheetRow>();
  let collapsedRelistings = 0;
  for (const row of filtered) {
    const rawName = row[COL.name] ?? '';
    const key = `${normalizeNameForDiff(baseListingName(rawName))}|${row[COL.state]}|${row[COL.county]}`;
    const existing = byBaseKey.get(key);
    if (!existing) {
      byBaseKey.set(key, row);
      continue;
    }
    collapsedRelistings += 1;
    const existingIsBase = !isRelistingName(existing[COL.name] ?? '');
    const currentIsBase = !isRelistingName(rawName);
    if (currentIsBase && !existingIsBase) byBaseKey.set(key, row);
  }

  const listings: Listing[] = [...byBaseKey.values()].map((row) => {
    const refnum = (row[COL.refnum] ?? '').trim();
    const externalRaw = (row[COL.externalLink] ?? '').trim();
    const externalLink = /^https:\/\/(?:catalog\.archives\.gov|npgallery\.nps\.gov)\//u.test(externalRaw)
      ? externalRaw
      : null;
    return {
      refnum,
      displayName: baseListingName(row[COL.name] ?? '').trim(),
      state: titleCase((row[COL.state] ?? '').trim()),
      county: (row[COL.county] ?? '').trim(),
      city: (row[COL.city] ?? '').trim(),
      areaOfSignificance: (row[COL.area] ?? '').trim(),
      category: (row[COL.category] ?? '').trim(),
      listedDateSerial: row[COL.listedDate]?.trim() || null,
      restrictedAddress: (row[COL.restricted] ?? '').trim() === '1',
      canonicalUrl: externalLink ?? `https://npgallery.nps.gov/AssetDetail/NRIS/${refnum}`,
      externalLink,
      lat: null,
      lng: null,
    };
  });
  console.log(`Distinct properties after collapsing ${collapsedRelistings} re-listing row(s): ${listings.length}.`);

  // 5. Geo join via NPS ArcGIS points layer (batches of 100 refnums).
  let geoMatched = 0;
  for (let i = 0; i < listings.length; i += 100) {
    const batch = listings.slice(i, i + 100);
    const where = `NRIS_Refnum IN (${batch.map((l) => `'${l.refnum}'`).join(',')})`;
    const body = new URLSearchParams({
      where,
      outFields: 'NRIS_Refnum',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
    });
    const data = (await fetchJson(ARCGIS_POINTS_LAYER, { method: 'POST', body })) as {
      features?: readonly { attributes?: { NRIS_Refnum?: string }; geometry?: { x?: number; y?: number } }[];
    } | null;
    for (const feature of data?.features ?? []) {
      const ref = feature.attributes?.NRIS_Refnum;
      const listing = batch.find((l) => l.refnum === ref);
      if (listing && typeof feature.geometry?.x === 'number' && typeof feature.geometry?.y === 'number') {
        if (listing.lat === null) geoMatched += 1;
        listing.lat = feature.geometry.y;
        listing.lng = feature.geometry.x;
      }
    }
    if (i % 1000 === 0) console.log(`  geo join: ${Math.min(i + 100, listings.length)}/${listings.length} (matched so far: ${geoMatched})`);
  }
  console.log(`Geo join complete: ${geoMatched}/${listings.length} listings matched to ArcGIS points.`);

  // 6. Dedup vs existing landscape candidates (all lanes) and canonical entities.
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const existingLandscapeRes = await pool.query<{ display_name: string; lane: string }>(
    `SELECT display_name, lane FROM bb_research.landscape_candidates`,
  );
  const existingEntitiesRes = await pool.query<{ display_name: string }>(
    `SELECT display_name FROM bb_canonical.entities`,
  );
  const existingLandscapeNames = new Set(
    existingLandscapeRes.rows.map((row) => normalizeNameForDiff(row.display_name)),
  );
  const existingEntityNames = new Set(
    existingEntitiesRes.rows.map((row) => normalizeNameForDiff(row.display_name)),
  );
  console.log(
    `Existing landscape_candidates (all lanes): ${existingLandscapeRes.rows.length}. ` +
      `bb_canonical.entities total: ${existingEntitiesRes.rows.length}.`,
  );

  let dedupedOutLandscape = 0;
  const dedupedOutCanonicalEntityNames: string[] = [];
  const netNewRows: Listing[] = [];
  for (const listing of listings) {
    const normalized = normalizeNameForDiff(listing.displayName);
    if (existingLandscapeNames.has(normalized)) {
      dedupedOutLandscape += 1;
      continue;
    }
    if (existingEntityNames.has(normalized)) {
      dedupedOutCanonicalEntityNames.push(listing.displayName);
      continue;
    }
    netNewRows.push(listing);
  }

  // 7. Sample URL verification: N random net-new canonical URLs must fetch 200.
  const sampleFailures: { displayName: string; canonicalUrl: string; status: number | string }[] = [];
  const sampled: { displayName: string; canonicalUrl: string }[] = [];
  const stride = Math.max(1, Math.floor(netNewRows.length / Math.max(1, SAMPLE_SIZE)));
  for (let i = 0; i < netNewRows.length && sampled.length < SAMPLE_SIZE; i += stride) {
    const row = netNewRows[i]!;
    sampled.push({ displayName: row.displayName, canonicalUrl: row.canonicalUrl });
    try {
      const res = await fetch(row.canonicalUrl, { headers: { 'user-agent': BROWSER_UA }, redirect: 'follow' });
      if (!res.ok) sampleFailures.push({ displayName: row.displayName, canonicalUrl: row.canonicalUrl, status: res.status });
    } catch (error) {
      sampleFailures.push({
        displayName: row.displayName,
        canonicalUrl: row.canonicalUrl,
        status: error instanceof Error ? error.message : 'fetch error',
      });
    }
  }
  console.log(`URL sample verification: ${sampled.length} sampled, ${sampleFailures.length} failure(s).`);
  if (sampleFailures.length > 0) {
    console.table(sampleFailures);
    throw new Error('sample URL verification failed — refusing to stage; inspect canonical URL construction');
  }

  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    sourceUrl: xlsxUrl,
    sourceProgramId: SOURCE_PROGRAM_ID,
    sourceProgramName: SOURCE_PROGRAM_NAME,
    dryRun: DRY_RUN || !APPLY,
    counts: {
      datasetRows: rows.length - 1,
      blackSignificanceListed: filtered.length,
      collapsedRelistings,
      distinctProperties: listings.length,
      geoMatched,
      dedupedOutLandscape,
      dedupedOutCanonicalEntities: dedupedOutCanonicalEntityNames.length,
      urlSampleSize: sampled.length,
      urlSampleFailures: sampleFailures.length,
      netNew: netNewRows.length,
    },
    urlSample: sampled,
    dedupedOutCanonicalEntityNames,
    netNewPreview: netNewRows.slice(0, 25).map((l) => ({
      name: l.displayName,
      state: l.state,
      city: l.city,
      refnum: l.refnum,
      url: l.canonicalUrl,
      lat: l.lat,
      lng: l.lng,
    })),
  };

  console.log(
    `\nCounts: dataset=${report.counts.datasetRows} black-listed=${filtered.length} ` +
      `distinct=${listings.length} geo-matched=${geoMatched} deduped-out(landscape)=${dedupedOutLandscape} ` +
      `deduped-out(canonical)=${dedupedOutCanonicalEntityNames.length} net-new=${netNewRows.length}`,
  );
  console.log('\nNet-new preview (first 25):');
  console.table(report.netNewPreview);

  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, safeReportFilename('nrhp-black-heritage', generatedAt));
  writeFileSync(
    reportPath,
    JSON.stringify({ ...report, netNewRows }, null, 2),
  );
  console.log(`\nReport written to ${reportPath}`);

  if (DRY_RUN || !APPLY) {
    console.log('\nDRY_RUN=1 (default): no database writes. Set DRY_RUN=0 NRHP_BLACK_HERITAGE_APPLY=1 to apply.');
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const runId = `nrhp-black-heritage-${generatedAt.slice(0, 10)}`;
    await client.query(
      `INSERT INTO bb_research.source_program_runs
        (id, lane, source_program_id, source_program_name, canonical_url, retrieved_at,
         rows_fetched, candidate_count, dropped_count, summary, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       ON CONFLICT (id) DO UPDATE SET
         rows_fetched = EXCLUDED.rows_fetched,
         candidate_count = EXCLUDED.candidate_count,
         dropped_count = EXCLUDED.dropped_count,
         summary = EXCLUDED.summary,
         updated_at = now()`,
      [
        runId,
        RUN_LANE,
        SOURCE_PROGRAM_ID,
        SOURCE_PROGRAM_NAME,
        xlsxUrl,
        generatedAt,
        filtered.length,
        netNewRows.length,
        filtered.length - netNewRows.length,
        JSON.stringify(report.counts),
      ],
    );
    for (const row of netNewRows) {
      await client.query(
        `INSERT INTO bb_research.landscape_candidates
          (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
           lat, lng, canonical_url, research_lane_only, status, provenance, payload, discovered_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'pending',$12,$13,$14,now())
         ON CONFLICT (lane, source_item_id) DO NOTHING`,
        [
          `${LANE}-${row.refnum}`,
          runId,
          LANE,
          SOURCE_PROGRAM_ID,
          row.refnum,
          row.displayName,
          'place',
          null,
          row.lat,
          row.lng,
          row.canonicalUrl,
          JSON.stringify({
            sourceId: SOURCE_PROGRAM_ID,
            sourceUrl: row.canonicalUrl,
            capturedAt: generatedAt,
            datasetUrl: xlsxUrl,
            refnum: row.refnum,
          }),
          JSON.stringify(row),
          generatedAt,
        ],
      );
    }
    await client.query('COMMIT');
    console.log(
      `Applied: upserted run ${runId} (lane='${RUN_LANE}'), inserted up to ${netNewRows.length} candidate row(s) (lane='${LANE}').`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
