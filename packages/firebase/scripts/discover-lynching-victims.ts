/**
 * Targeted discovery for documented lynching victims: Wikipedia's "List of
 * lynching victims in the United States" is 11 wikitables (one per era, ~828
 * rows total) with columns Name/Age/Ethnicity/City/County/State/Date/
 * Accusation/Comment, individually cited (Tuskegee Institute records plus,
 * for many victims, a dedicated per-lynching Wikipedia article). Filtered to
 * "African American" rows only (the article also documents ~1,300 White
 * victims, out of BlackStory's scope here).
 *
 * This is the one discovery script this session that genuinely needed care
 * beyond the simple bulleted-list pattern (discover-sundown-towns.ts,
 * discover-reconstruction-officeholders.ts): MediaWiki `rowspan="N"` cells
 * apply a single value across N consecutive rows (ethnicity, city, county,
 * state, date, and/or accusation are frequently shared across a group of
 * victims from the same incident) — reading rows independently would
 * silently misattribute a shared column to the wrong row once a rowspan
 * expires. Verified against real 2+ and 8-row rowspan groups in the source
 * before trusting this at scale (see the corroborating memory entry).
 *
 * As a safety margin against the rare row that's ALSO missing other columns
 * in the source (observed twice out of 549 rows during verification), any
 * extracted row with no `state` value is dropped rather than guessed at —
 * a genuinely location-less record can't be usefully researched anyway, and
 * the existing pipeline's location gate would hold it either way.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-lynching-victims.ts --out <candidates.json>
 */
import { writeFileSync } from 'node:fs';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'BlackStory research pipeline (contact: geraldmarondagher@gmail.com)';
const LIST_ARTICLE_TITLE = 'List of lynching victims in the United States';

const COLUMNS = ['name', 'age', 'ethnicity', 'city', 'county', 'state', 'date', 'accusation', 'comment'] as const;
type Column = (typeof COLUMNS)[number];
type Victim = Record<Column, string>;

type GapCandidate = {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly summary: string;
  readonly gapFill: {
    readonly mentionedByEntityIds: readonly string[];
    readonly mentionContexts: readonly string[];
    readonly candidateSourceHrefs: readonly string[];
  };
};

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function fetchWikitext(title: string): Promise<string> {
  const params = new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext', format: 'json' });
  const response = await fetch(`${WIKIPEDIA_API}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Wikipedia parse API returned ${response.status}`);
  const raw = (await response.json()) as { parse?: { wikitext?: { '*': string } } };
  const text = raw.parse?.wikitext?.['*'];
  if (!text) throw new Error('No wikitext in response');
  return text;
}

function stripWikiMarkup(text: string): string {
  return text
    .replace(/<ref[^>]*\/>/gu, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gu, '')
    .replace(/\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|[^}]*)?\}\}/gu, '$1 $2')
    .replace(/\{\{efn\|[\s\S]*?\}\}/gu, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/gu, '$2')
    .replace(/\[\[([^\]]+)\]\]/gu, '$1')
    .replace(/'''([^']+)'''/gu, '$1')
    .replace(/''([^']+)''/gu, '$1')
    .replace(/\{\{[^}]*\}\}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Extracts a person's plain name from a {{sortname|First|Last|...}} template or plain "Last, First" text. */
function extractName(raw: string): string {
  const sortname = /\{\{sortname\|([^|}]+)\|([^|}]*)/u.exec(raw);
  if (sortname) return `${sortname[1]} ${sortname[2]}`.trim();
  const stripped = stripWikiMarkup(raw);
  const lastFirst = /^([^,]+),\s*(.+)$/u.exec(stripped);
  if (lastFirst) return `${lastFirst[2]} ${lastFirst[1]}`.trim();
  return stripped;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

/** Splits a cell-separator string on `||` (or newline-`|`) only OUTSIDE {{...}}, [[...]], and <ref>...</ref> nesting. */
function splitRespectingNesting(text: string, sep: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    if (two === '{{' || two === '[[') {
      depth += 1;
      current += two;
      i += 2;
      continue;
    }
    if (two === '}}' || two === ']]') {
      depth = Math.max(0, depth - 1);
      current += two;
      i += 2;
      continue;
    }
    if (text.slice(i, i + 5) === '<ref ' || text.slice(i, i + 5) === '<ref>') {
      const close = text.indexOf('</ref>', i);
      if (close === -1) {
        current += text.slice(i);
        break;
      }
      current += text.slice(i, close + 6);
      i = close + 6;
      continue;
    }
    if (depth === 0 && text.slice(i, i + sep.length) === sep) {
      parts.push(current);
      current = '';
      i += sep.length;
      continue;
    }
    current += text[i];
    i += 1;
  }
  parts.push(current);
  return parts;
}

function parseCell(raw: string): { rowspan: number; value: string } {
  let cell = raw.trim();
  if (cell.startsWith('|')) cell = cell.slice(1).trim();
  const rowspanMatch = /^rowspan\s*=\s*"?(\d+)"?\s*\|([\s\S]*)$/u.exec(cell);
  if (rowspanMatch) return { rowspan: Number(rowspanMatch[1]), value: rowspanMatch[2].trim() };
  return { rowspan: 1, value: cell };
}

function splitRowIntoCells(rowBlock: string): readonly string[] | undefined {
  const trimmed = rowBlock.replace(/^\n+|\n+$/gu, '');
  if (trimmed.startsWith('!')) return undefined; // header row
  const lines = trimmed.split('\n');
  const cells: string[] = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) continue;
    if (!stripped.startsWith('|')) {
      if (cells.length > 0) cells[cells.length - 1] += `\n${line}`;
      continue;
    }
    cells.push(...splitRespectingNesting(stripped, '||'));
  }
  return cells;
}

function parseTable(tableText: string): readonly Victim[] {
  const rowBlocks = tableText.split(/\n\|-/u).slice(1);
  const carry = new Map<number, { value: string; remaining: number }>();
  const victims: Victim[] = [];

  for (const rowBlock of rowBlocks) {
    const cells = splitRowIntoCells(rowBlock);
    if (!cells || cells.length === 0) continue;
    const values: string[] = [];
    let cellIndex = 0;
    for (let col = 0; col < COLUMNS.length; col += 1) {
      const carried = carry.get(col);
      if (carried && carried.remaining > 0) {
        values[col] = carried.value;
        carried.remaining -= 1;
        if (carried.remaining === 0) carry.delete(col);
        continue;
      }
      const rawCell = cells[cellIndex];
      cellIndex += 1;
      if (rawCell === undefined) {
        values[col] = '';
        continue;
      }
      const { rowspan, value } = parseCell(rawCell);
      values[col] = value;
      if (rowspan > 1) carry.set(col, { value, remaining: rowspan - 1 });
    }
    victims.push(Object.fromEntries(COLUMNS.map((name, i) => [name, values[i] ?? ''])) as Victim);
  }

  return victims;
}

function extractAllTables(wikitext: string): readonly string[] {
  const tables: string[] = [];
  let pos = 0;
  for (;;) {
    const start = wikitext.indexOf('{|', pos);
    if (start === -1) break;
    const end = wikitext.indexOf('|}', start);
    if (end === -1) break;
    tables.push(wikitext.slice(start, end + 2));
    pos = end + 2;
  }
  return tables;
}

async function main(): Promise<void> {
  const outPath = readArgFlag('--out');
  if (!outPath) {
    console.error('Usage: --out <candidates.json>');
    process.exit(2);
  }

  const wikitext = await fetchWikitext(LIST_ARTICLE_TITLE);
  const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(LIST_ARTICLE_TITLE.replace(/ /gu, '_'))}`;
  const tables = extractAllTables(wikitext);
  const allVictims = tables.flatMap(parseTable);
  const blackVictims = allVictims.filter((v) => v.ethnicity.includes('African American') && v.state.trim().length > 0);

  const seen = new Map<string, number>();
  const candidates: GapCandidate[] = [];
  for (const v of blackVictims) {
    const name = extractName(v.name) || 'Unknown';
    const city = stripWikiMarkup(v.city);
    const county = stripWikiMarkup(v.county);
    const state = stripWikiMarkup(v.state);
    const date = stripWikiMarkup(v.date);
    const accusation = stripWikiMarkup(v.accusation);
    const comment = stripWikiMarkup(v.comment);
    const place = [city, state].filter(Boolean).join(', ') || state;

    const baseSlug = slugify(`${name}_${place}`);
    const occurrence = (seen.get(baseSlug) ?? 0) + 1;
    seen.set(baseSlug, occurrence);
    const id = `lynching_${baseSlug}${occurrence > 1 ? `_${occurrence}` : ''}`;

    const evidence = [
      date ? `Lynched ${date}` : 'Lynched',
      place ? `in ${place}${county ? ` (${county} County)` : ''}` : '',
      accusation ? `following an accusation of: ${accusation}` : '',
      comment ? `. ${comment}` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    candidates.push({
      id,
      kind: 'person',
      displayName: name,
      summary: evidence.slice(0, 400),
      gapFill: {
        mentionedByEntityIds: [],
        mentionContexts: [`Documented lynching victim: ${evidence}`.slice(0, 500)],
        candidateSourceHrefs: [sourceUrl],
      },
    });
  }

  writeFileSync(outPath, `${JSON.stringify({ candidates }, null, 2)}\n`);
  console.log(
    JSON.stringify({
      tablesParsed: tables.length,
      totalRows: allVictims.length,
      blackVictimRows: blackVictims.length,
      candidatesWritten: candidates.length,
      outPath,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
