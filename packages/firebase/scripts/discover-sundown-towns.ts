/**
 * Targeted discovery for sundown towns: Wikipedia's "List of sundown towns in
 * the United States" is a single, well-cited article (James Loewen's research
 * plus contemporary newspapers) organized by state, one bulleted entry per
 * town with its own documented evidence — a far better source than blind
 * keyword search, which discover-candidates.ts's looksRelevant() filter can't
 * use here: a town's short Wikidata description ("city in Illinois") never
 * mentions race, so every individual town gets filtered out no matter how
 * well-documented its sundown-town history is. This instead follows the
 * SAME "find the authoritative list, extract from it" pattern real research
 * uses, and outputs candidates in the exact shape
 * build-gap-fill-enrichment-subjects.ts already consumes, so the rest of the
 * night's pipeline (research -> judge -> auto-promote -> publish) needs no
 * changes.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-sundown-towns.ts --out <candidates.json>
 */
import { writeFileSync } from 'node:fs';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'BlackStory research pipeline (contact: geraldmarondagher@gmail.com)';
const LIST_ARTICLE_TITLE = 'List of sundown towns in the United States';

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

/** Strips MediaWiki markup down to plain readable text: refs, wikilinks, bold/italic. */
function stripWikiMarkup(text: string): string {
  return text
    .replace(/<ref[^>]*\/>/gu, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gu, '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/gu, '$2')
    .replace(/\[\[([^\]]+)\]\]/gu, '$1')
    .replace(/'''([^']+)'''/gu, '$1')
    .replace(/''([^']+)''/gu, '$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

/**
 * Parses the "Sundown communities by state" section: `=== StateName ===`
 * subsections, each containing `* [[Town, State]], <documented evidence>.`
 * bullets. Stops at the References/External links sections.
 */
function extractTowns(wikitext: string, sourceUrl: string): readonly GapCandidate[] {
  const lines = wikitext.split('\n');
  const candidates: GapCandidate[] = [];
  let inStateSection = false;
  let currentState: string | undefined;
  // Citation templates ({{cite web |...}} inside <ref>...</ref>) routinely wrap
  // across multiple wikitext lines — a bullet's full entry, including its
  // closing </ref>, isn't always on the single line the bullet starts on.
  // Accumulate continuation lines (anything until the next bullet or header)
  // into one block before stripping markup, or a still-open <ref> tag leaks
  // raw wikitext into the extracted evidence.
  let currentBlock: string[] = [];

  function flushBlock(): void {
    if (currentBlock.length === 0) return;
    const block = currentBlock.join(' ');
    currentBlock = [];
    const linkMatch = /^\*\s*\[\[([^|\]]+)(?:\|([^\]]+))?\]\](.*)$/su.exec(block);
    if (!linkMatch) return;
    const [, target, displayText, restRaw] = linkMatch;
    const townTitle = (displayText ?? target ?? '').trim();
    if (!townTitle) return;
    const evidence = stripWikiMarkup((restRaw ?? '').replace(/^[,:]\s*/u, ''));
    if (!evidence) return;

    candidates.push({
      id: `sundown_${slugify(townTitle)}`,
      kind: 'place',
      displayName: townTitle,
      summary: evidence.slice(0, 400),
      gapFill: {
        mentionedByEntityIds: [],
        mentionContexts: [
          `Documented sundown town${currentState ? ` (${currentState})` : ''}: ${evidence}`.slice(0, 500),
        ],
        candidateSourceHrefs: [sourceUrl],
      },
    });
  }

  for (const line of lines) {
    const level2 = /^==\s*(.+?)\s*==$/u.exec(line);
    if (level2 && !/^===/u.test(line)) {
      flushBlock();
      inStateSection = level2[1] === 'Sundown communities by state';
      continue;
    }
    if (!inStateSection) continue;

    const level3 = /^===\s*(.+?)\s*===$/u.exec(line);
    if (level3) {
      flushBlock();
      currentState = level3[1];
      continue;
    }

    if (line.startsWith('* [[')) {
      flushBlock();
      currentBlock = [line];
    } else if (currentBlock.length > 0 && line.trim().length > 0) {
      // A continuation of the current bullet's citation template.
      currentBlock.push(line);
    } else if (currentBlock.length > 0 && line.trim().length === 0) {
      flushBlock();
    }
  }
  flushBlock();

  return candidates;
}

async function main(): Promise<void> {
  const outPath = readArgFlag('--out');
  if (!outPath) {
    console.error('Usage: --out <candidates.json>');
    process.exit(2);
  }

  const wikitext = await fetchWikitext(LIST_ARTICLE_TITLE);
  const sourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(LIST_ARTICLE_TITLE.replace(/ /gu, '_'))}`;
  const candidates = extractTowns(wikitext, sourceUrl);

  const seen = new Set<string>();
  const deduped = candidates.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  writeFileSync(outPath, `${JSON.stringify({ candidates: deduped }, null, 2)}\n`);
  console.log(JSON.stringify({ totalExtracted: candidates.length, uniqueCandidates: deduped.length, outPath }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
