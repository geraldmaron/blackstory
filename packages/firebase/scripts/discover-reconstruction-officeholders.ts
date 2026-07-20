/**
 * Targeted discovery for Reconstruction-era Black officeholders (1865-1900):
 * Wikipedia's "African American officeholders from the end of the Civil War
 * until before 1900" is a single, comprehensive article organized by office
 * type (U.S. Senate/House) then by state and office level (state senate,
 * state house, constitutional convention, local offices), one bulleted name
 * per entry. ~1,927 individuals — every one served before 1900, so unlike
 * the gap-fill person-privacy holds from earlier tonight, none of these
 * require living-status review; they're all safely historical.
 *
 * Same "find the authoritative list, extract from it" pattern as
 * discover-sundown-towns.ts, outputting the same candidate shape
 * build-gap-fill-enrichment-subjects.ts already consumes.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/discover-reconstruction-officeholders.ts --out <candidates.json>
 */
import { writeFileSync } from 'node:fs';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'BlackStory research pipeline (contact: geraldmarondagher@gmail.com)';
const LIST_ARTICLE_TITLE = 'African American officeholders from the end of the Civil War until before 1900';

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
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/gu, '$2')
    .replace(/\[\[([^\]]+)\]\]/gu, '$1')
    .replace(/'''([^']+)'''/gu, '$1')
    .replace(/''([^']+)''/gu, '$1')
    .replace(/\{\{[^}]*\}\}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

/** Wikilink target minus any disambiguating parenthetical, e.g. "Thomas J. Clarke (Alabama politician)" -> "Thomas J. Clarke". */
function cleanPersonName(target: string, displayText: string | undefined): string {
  const raw = (displayText ?? target).trim();
  return raw.replace(/\s*\([^)]*\)\s*$/u, '').trim();
}

function extractOfficeholders(wikitext: string, sourceUrl: string): readonly GapCandidate[] {
  const lines = wikitext.split('\n');
  const candidates: GapCandidate[] = [];
  let sectionStack: { level: number; title: string }[] = [];
  let stopped = false;

  function currentContext(): string {
    return sectionStack.map((s) => s.title).join(' > ');
  }

  let currentBlock: string[] = [];

  function flushBlock(): void {
    if (currentBlock.length === 0) return;
    const block = currentBlock.join(' ');
    currentBlock = [];
    const linkMatch = /^\*\s*\[\[([^|\]]+)(?:\|([^\]]+))?\]\](.*)$/su.exec(block);
    if (!linkMatch) return;
    const [, target, displayText, restRaw] = linkMatch;
    const personName = cleanPersonName(target, displayText);
    if (!personName) return;
    const officeInfo = stripWikiMarkup((restRaw ?? '').replace(/^[\s–-]+/u, ''));

    candidates.push({
      id: `recon_${slugify(personName)}`,
      kind: 'person',
      displayName: personName,
      summary: `${currentContext()}${officeInfo ? `: ${officeInfo}` : ''}`.slice(0, 400),
      gapFill: {
        mentionedByEntityIds: [],
        mentionContexts: [
          `Reconstruction-era Black officeholder (${currentContext()}): ${officeInfo}`.slice(0, 500),
        ],
        candidateSourceHrefs: [sourceUrl],
      },
    });
  }

  for (const line of lines) {
    if (stopped) break;
    const headerMatch = /^(==+)\s*(.+?)\s*\1$/u.exec(line);
    if (headerMatch) {
      flushBlock();
      const level = headerMatch[1].length;
      const title = headerMatch[2];
      if (title === 'See also' || title === 'Notes' || title === 'References' || title === 'Further reading') {
        stopped = true;
        break;
      }
      sectionStack = sectionStack.filter((s) => s.level < level);
      sectionStack.push({ level, title });
      continue;
    }

    if (line.startsWith('* [[')) {
      flushBlock();
      currentBlock = [line];
    } else if (currentBlock.length > 0 && line.trim().length > 0 && !line.startsWith('*')) {
      currentBlock.push(line);
    } else if (currentBlock.length > 0) {
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
  const candidates = extractOfficeholders(wikitext, sourceUrl);

  const seen = new Set<string>();
  const deduped = candidates.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));

  writeFileSync(outPath, `${JSON.stringify({ candidates: deduped }, null, 2)}\n`);
  console.log(JSON.stringify({ totalExtracted: candidates.length, uniqueCandidates: deduped.length, outPath }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
