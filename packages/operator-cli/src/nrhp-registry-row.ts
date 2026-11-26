/**
 * One row of the NPS listed-properties spreadsheet, as a capturable source.
 *
 * An NRHP record's listing date, reference number and area of significance come from that
 * spreadsheet, not from the NPGallery asset page the lane used to cite, which states no listing
 * date and is an empty shell for recent listings. A row URL is the dataset URL plus
 * `?refnum=<reference number>` (the server ignores the query, and the capture pipeline drops
 * fragments, so a fragment could not carry it); fetching it yields that property's row as labeled lines, so a
 * reviewer can check the listing claims against what the register itself records.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../.cache/landscape-intake');
const DATASET_PATH = /^\/subjects\/nationalregister\/upload\/national-register-listed_\d+\.xlsx$/u;
const QUERY = /^\?refnum=([A-Za-z0-9]+)$/u;

/** The dataset the lane's current rows were checked against. */
export const NRHP_LISTED_DATASET_URL =
  'https://www.nps.gov/subjects/nationalregister/upload/national-register-listed_20260522.xlsx';

export function nrhpRegistryRowUrl(refnum: string, datasetUrl = NRHP_LISTED_DATASET_URL): string {
  return `${datasetUrl}?refnum=${refnum}`;
}

/** Dataset URL and reference number when `url` is a registry row URL on nps.gov, else undefined. */
export function parseNrhpRegistryRowUrl(
  url: string,
): { readonly datasetUrl: string; readonly refnum: string } | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const refnum = QUERY.exec(parsed.search)?.[1];
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.nps.gov' || !refnum)
    return undefined;
  if (!DATASET_PATH.test(parsed.pathname) || parsed.hash) return undefined;
  return { datasetUrl: `${parsed.origin}${parsed.pathname}`, refnum };
}

export function unescapeXml(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
  };
  return text
    .replace(/&(?:amp|lt|gt|quot|apos);/gu, (m) => entities[m] ?? m)
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

export type SheetRow = Readonly<Record<string, string>>;

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

/** Spreadsheet serial (days since 1899-12-30) as "Month D, YYYY"; same rule as formatNrhpListedDate. */
function serialDate(serial: string): string | null {
  const days = Number.parseInt(serial, 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(1899, 11, 30) + days * 86_400_000));
}

const label = (header: SheetRow, column: string): string => (header[column] ?? '').trim();

/**
 * Every row carrying `refnum`, as labeled lines in sheet order. Date cells keep the stored
 * serial and add the date it stands for. A street address is left out when the register marks
 * the address restricted.
 */
export function renderNrhpRegistryRows(
  header: SheetRow,
  rows: readonly SheetRow[],
  refnum: string,
): string | undefined {
  const columnOf = (name: string): string | undefined =>
    Object.keys(header).find((column) => label(header, column).toLowerCase() === name);
  const refColumn = columnOf('ref#');
  if (!refColumn) throw new Error('listed-properties sheet has no Ref# column');
  const restricted = columnOf('restricted address');
  const street = columnOf('street & number');
  const matches = rows.filter((row) => (row[refColumn] ?? '').trim() === refnum);
  if (matches.length === 0) return undefined;
  const blocks = matches.map((row) =>
    Object.keys(header)
      .filter((column) => (row[column] ?? '').trim().length > 0)
      .filter((column) => !(column === street && restricted && row[restricted] === '1'))
      .map((column) => {
        const name = label(header, column);
        const value = (row[column] ?? '').trim();
        const date = / date$/iu.test(name) ? serialDate(value) : null;
        return `${name}: ${value}${date ? ` (${date})` : ''}`;
      })
      .join('\n'),
  );
  return [
    'National Park Service, National Register of Historic Places, listed properties spreadsheet.',
    ...blocks,
  ].join('\n\n');
}

const sheets = new Map<string, { header: SheetRow; rows: readonly SheetRow[] }>();

async function loadSheet(
  datasetUrl: string,
): Promise<{ header: SheetRow; rows: readonly SheetRow[] }> {
  const known = sheets.get(datasetUrl);
  if (known) return known;
  mkdirSync(CACHE_DIR, { recursive: true });
  // basename of a path already matched against DATASET_PATH, so it cannot leave CACHE_DIR.
  const local = join(CACHE_DIR, basename(new URL(datasetUrl).pathname));
  try {
    const handle = openSync(local, 'wx');
    try {
      const response = await fetch(datasetUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!response.ok) throw new Error(`spreadsheet download failed: ${response.status}`);
      writeFileSync(handle, Buffer.from(await response.arrayBuffer()));
    } finally {
      closeSync(handle);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const maxBuffer = 512 * 1024 * 1024;
  const part = (name: string): string =>
    execFileSync('unzip', ['-p', local, name], { maxBuffer }).toString('utf8');
  const all = parseSheetRows(
    part('xl/worksheets/sheet1.xml'),
    parseSharedStrings(part('xl/sharedStrings.xml')),
  );
  const [header, ...rows] = all;
  if (!header) throw new Error('listed-properties sheet is empty');
  const sheet = { header, rows };
  sheets.set(datasetUrl, sheet);
  return sheet;
}

/** Fetch result for a registry row URL, in the shape the capture pipeline takes from safe-fetch. */
export async function fetchNrhpRegistryRow(url: string) {
  const target = parseNrhpRegistryRowUrl(url);
  if (!target) throw new Error(`not an NRHP registry row URL: ${url}`);
  const { header, rows } = await loadSheet(target.datasetUrl);
  const text = renderNrhpRegistryRows(header, rows, target.refnum);
  if (text === undefined) {
    return {
      ok: false,
      reason: 'transport_failed',
      quarantineState: 'rejected',
      publicationAllowed: false,
    } as const;
  }
  return {
    ok: true,
    finalUrl: url,
    redirectCount: 0,
    status: 200,
    contentType: 'text/plain',
    byteLength: Buffer.byteLength(text, 'utf8'),
    contentHash: createHash('sha256').update(text, 'utf8').digest('hex'),
    parser: { safe: true, indicators: [], extractedText: text },
    quarantineState: 'validated',
    publicationAllowed: false,
  } as const;
}

/** Scanned nomination PDFs run 20 to 30 MB, far over the default 2 MB cap; only NPS's own asset path gets more. */
export const NOMINATION_PDF_LIMITS = {
  maxResponseBytes: 64 * 1024 * 1024,
  maxDurationMs: 90_000,
} as const;

export function isNpgalleryNomination(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'npgallery.nps.gov' &&
      parsed.pathname.startsWith('/NRHP/GetAsset/')
    );
  } catch {
    return false;
  }
}
