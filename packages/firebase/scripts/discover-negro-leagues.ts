/**
 * Targeted discovery for Negro Leagues baseball — under-represented in the
 * catalog (2026-07-20 audit across all 1073+ records: only 7 "negro league"
 * hits, all incidental — the league's founding, its museum, and Rube Foster —
 * with no actual teams and almost no players).
 *
 * Same "find the one authoritative table, parse it directly" pattern as
 * discover-sundown-towns.ts and discover-lynching-victims.ts: Wikipedia's
 * "Negro league baseball" article has a single sortable wikitable, "Table of
 * Hall of Fame players", listing every National Baseball Hall of Fame
 * inductee whose PRIMARY career was in the Negro Leagues (player, position,
 * primary team, career years, induction year) — fetched live via the section
 * wikitext so it stays correct if the article is re-edited, rather than
 * hardcoding the roster. Deliberately excludes the article's second table
 * (Hall of Famers inducted for their MLB career who merely started in the
 * Negro Leagues — Jackie Robinson, Hank Aaron, Willie Mays, etc.): those are
 * already extensively covered elsewhere in the catalog under other
 * campaigns, so parsing that table would mostly just re-surface duplicates.
 *
 * The table's own "Primary team" column also names each player's Negro
 * Leagues team (Kansas City Monarchs, Homestead Grays, Newark Eagles, …) —
 * those are extracted as their own organization candidates (deduplicated),
 * closing the "teams" side of the gap from the same single source.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-negro-leagues.ts --out <candidates.json>
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCommonsMediaClient } from '@repo/domain';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG_DIR = join(PACKAGE_ROOT, 'fixtures/national-catalog');

const WIKIMEDIA_USER_AGENT =
  'BlackStoryDiscovery/1.0 (https://blackstory.app; research-dry-run; mailto:ops@blackstory.app)';
const API = 'https://en.wikipedia.org/w/api.php';
const SOURCE_PAGE = 'Negro league baseball';
const TABLE_SECTION_LINE = 'table of hall of fame players';

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function normalizeTitleKey(title: string): string {
  return title.replace(/_/g, ' ').trim().toLowerCase();
}

function loadCatalogNames(): { names: Set<string>; ids: Set<string> } {
  const names = new Set<string>();
  const ids = new Set<string>();
  if (!existsSync(CATALOG_DIR)) return { names, ids };
  for (const file of readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.json'))) {
    let entries: unknown;
    try {
      entries = JSON.parse(readFileSync(join(CATALOG_DIR, file), 'utf8'));
    } catch {
      continue;
    }
    const list = Array.isArray(entries) ? entries : [entries];
    for (const raw of list) {
      if (raw && typeof raw === 'object' && 'id' in raw) {
        const rec = raw as Record<string, unknown>;
        if (typeof rec.id === 'string') ids.add(rec.id);
        if (typeof rec.displayName === 'string') names.add(rec.displayName.toLowerCase());
      }
    }
  }
  return { names, ids };
}

async function findSectionIndex(page: string, matchLine: string): Promise<string> {
  const params = new URLSearchParams({ action: 'parse', page, prop: 'sections', format: 'json' });
  const response = await fetch(`${API}?${params.toString()}`, {
    headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`parse/sections HTTP ${response.status}`);
  const raw = (await response.json()) as {
    readonly parse?: { readonly sections?: readonly { readonly index: string; readonly line: string }[] };
  };
  const section = raw.parse?.sections?.find((s) => s.line.trim().toLowerCase() === matchLine);
  if (!section) throw new Error(`section "${matchLine}" not found on ${page}`);
  return section.index;
}

async function fetchSectionWikitext(page: string, sectionIndex: string): Promise<string> {
  const params = new URLSearchParams({
    action: 'parse',
    page,
    section: sectionIndex,
    prop: 'wikitext',
    format: 'json',
  });
  const response = await fetch(`${API}?${params.toString()}`, {
    headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`parse/wikitext HTTP ${response.status}`);
  const raw = (await response.json()) as { readonly parse?: { readonly wikitext?: { readonly '*'?: string } } };
  const text = raw.parse?.wikitext?.['*'];
  if (!text) throw new Error(`no wikitext for section ${sectionIndex} of ${page}`);
  return text;
}

type TableRow = {
  readonly playerTitle: string;
  readonly playerDisplay: string;
  readonly pos: string;
  readonly teamTitle: string;
  readonly teamDisplay: string;
  readonly career: string;
  readonly inducted: string;
};

function parseWikilink(cell: string): { readonly title: string; readonly display: string } {
  const match = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/u.exec(cell);
  if (!match) return { title: cell.trim(), display: cell.trim() };
  const title = match[1]!.trim();
  const display = (match[2] ?? match[1]!).trim();
  return { title, display };
}

function parseFirstWikitable(sectionWikitext: string): readonly TableRow[] {
  const tableStart = sectionWikitext.indexOf('{|');
  const tableEnd = sectionWikitext.indexOf('|}', tableStart);
  if (tableStart === -1 || tableEnd === -1) throw new Error('no wikitable found in section');
  const tableText = sectionWikitext.slice(tableStart, tableEnd);

  const rowBlocks = tableText.split('|-').slice(1);
  const rows: TableRow[] = [];
  for (const block of rowBlocks) {
    const cells = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('|') && !line.startsWith('|-') && !line.startsWith('|}'))
      .map((line) => line.slice(1).trim());
    if (cells.length < 5) continue;
    const [playerCell, posCell, teamCell, careerCell, inductedCell] = cells;
    const player = parseWikilink(playerCell!);
    const team = parseWikilink(teamCell!);
    rows.push({
      playerTitle: player.title,
      playerDisplay: player.display.replace(/[†‡]/gu, '').trim(),
      pos: posCell!.trim(),
      teamTitle: team.title,
      teamDisplay: team.display.trim(),
      career: careerCell!.replace(/<br\s*\/?>/giu, ' ').trim(),
      inducted: inductedCell!.trim(),
    });
  }
  return rows;
}

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

async function main(): Promise<void> {
  const outPath = readArgFlag('--out');
  if (!outPath) {
    console.error('Usage: --out <candidates.json>');
    process.exit(2);
  }

  const sectionIndex = await findSectionIndex(SOURCE_PAGE, TABLE_SECTION_LINE);
  const sectionWikitext = await fetchSectionWikitext(SOURCE_PAGE, sectionIndex);
  const rows = parseFirstWikitable(sectionWikitext);
  console.error(`parsed ${rows.length} Hall of Fame rows from "${SOURCE_PAGE}" §${sectionIndex}`);

  const { names: catalogNames, ids: catalogIds } = loadCatalogNames();
  const client = createCommonsMediaClient({ userAgent: WIKIMEDIA_USER_AGENT, batchDelayMs: 250 });

  const allTitles = [...new Set([...rows.map((r) => r.playerTitle), ...rows.map((r) => r.teamTitle)])];
  const resolved = await client.resolveEnwikiTitles(allTitles);
  const resolvedByTitle = new Map(resolved.map((r) => [normalizeTitleKey(r.title), r] as const));
  const qids = resolved.map((r) => r.wikidataId).filter((q): q is string => q !== undefined);
  const entities = await client.fetchEntitiesById(qids);

  function describe(title: string): { readonly label?: string; readonly description?: string } {
    const resolution = resolvedByTitle.get(normalizeTitleKey(title));
    const entity = resolution?.wikidataId ? entities.get(resolution.wikidataId) : undefined;
    return {
      label: entity?.labels?.en?.value ?? resolution?.label,
      description: entity?.descriptions?.en?.value,
    };
  }

  const candidates: GapCandidate[] = [];
  let skippedCatalogPlayers = 0;
  let skippedCatalogTeams = 0;
  const seenTeamTitles = new Set<string>();

  for (const row of rows) {
    const { label, description } = describe(row.playerTitle);
    const displayName = label ?? row.playerDisplay;
    const candidateId = `negro_leagues_player_${slugify(displayName)}`;
    if (catalogNames.has(displayName.toLowerCase()) || catalogIds.has(candidateId)) {
      skippedCatalogPlayers += 1;
    } else {
      const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(row.playerTitle.replace(/ /gu, '_'))}`;
      candidates.push({
        id: candidateId,
        kind: 'person',
        displayName,
        summary:
          description ??
          `${displayName} (${row.pos}) played for the ${row.teamDisplay} (${row.career}) and was inducted into the National Baseball Hall of Fame in ${row.inducted} for a career built in the Negro Leagues.`,
        gapFill: {
          mentionedByEntityIds: [],
          mentionContexts: [
            `National Baseball Hall of Fame inductee (${row.inducted}), primary career in the Negro Leagues with the ${row.teamDisplay} (${row.career}), position ${row.pos}. ${description ?? ''}`.trim(),
          ],
          candidateSourceHrefs: [sourceUrl],
        },
      });
    }

    // Dedupe on the RAW title first (cheap, skips most repeats before any
    // network lookup) — but two different raw titles can still resolve to the
    // same real team (e.g. "Lincoln Giants" and "New York Lincoln Giants" both
    // corroborate to the same Wikipedia article), so the final id-based check
    // below is the real guard.
    const teamKey = normalizeTitleKey(row.teamTitle);
    if (seenTeamTitles.has(teamKey)) continue;
    seenTeamTitles.add(teamKey);
    const teamInfo = describe(row.teamTitle);
    const teamDisplayName = teamInfo.label ?? row.teamDisplay;
    const teamCandidateId = `negro_leagues_team_${slugify(teamDisplayName)}`;
    if (catalogNames.has(teamDisplayName.toLowerCase()) || catalogIds.has(teamCandidateId)) {
      skippedCatalogTeams += 1;
      continue;
    }
    if (candidates.some((c) => c.id === teamCandidateId)) continue;
    const teamSourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(row.teamTitle.replace(/ /gu, '_'))}`;
    candidates.push({
      id: teamCandidateId,
      kind: 'organization',
      displayName: teamDisplayName,
      summary: teamInfo.description ?? `Negro Leagues baseball team; primary team of Hall of Fame inductee ${displayName}.`,
      gapFill: {
        mentionedByEntityIds: [],
        mentionContexts: [
          `Negro Leagues baseball team. ${teamInfo.description ?? `Primary team of National Baseball Hall of Fame inductee ${displayName} (${row.career}).`}`.trim(),
        ],
        candidateSourceHrefs: [teamSourceUrl],
      },
    });
  }

  writeFileSync(outPath, `${JSON.stringify({ candidates }, null, 2)}\n`);
  console.log(
    JSON.stringify({
      rowsParsed: rows.length,
      uniqueTeams: seenTeamTitles.size,
      skippedCatalogPlayers,
      skippedCatalogTeams,
      candidatesWritten: candidates.length,
      outPath,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
