/**
 * Turns a discover-candidates.ts run-*.json into enrichment-run subjects with
 * REAL fetched source text, instead of the bare one-line discovery summary +
 * an unfetched URL string. The judge can only extract claims it's actually
 * shown — passing it a stub summary and a link it's never read is why the
 * overnight discovery lane's keep rate was low; this closes that gap the
 * same way `build-starter-enrichment-subjects.ts` does for the starter seed.
 *
 * Best-effort: a source that fails to fetch (dead link, block, timeout) still
 * produces a subject — its snippet says so explicitly so the judge doesn't
 * treat silence as evidence, and a per-item failure never aborts the batch.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-discovery-enrichment-subjects.ts \
 *     --candidates <run-*.json> --out <subjects.json> [--max 200] [--concurrency 4]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const MAX_SNIPPET_CHARS = 4_000;
const FETCH_TIMEOUT_MS = 15_000;

type Candidate = {
  readonly id: string;
  readonly kind?: string;
  readonly displayName?: string;
  readonly summary?: string;
  readonly canonicalUrl?: string;
  readonly lat?: number;
  readonly lng?: number;
};

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&#\d+;|&[a-z]+;/giu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function fetchSourceText(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'BlackStory research pipeline (contact: geraldmarondagher@gmail.com)' },
    });
    if (!response.ok) return undefined;
    const text = htmlToText(await response.text());
    return text.length > 100 ? text.slice(0, MAX_SNIPPET_CHARS) : undefined;
  } catch {
    return undefined;
  }
}

async function mapPool<T, R>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function main(): Promise<void> {
  const candidatesPath = readArgFlag('--candidates');
  const outPath = readArgFlag('--out');
  const max = Number(readArgFlag('--max') ?? '200');
  const concurrency = Number(readArgFlag('--concurrency') ?? '4');
  if (!candidatesPath || !outPath) {
    console.error('Usage: --candidates <run-*.json> --out <subjects.json> [--max 200] [--concurrency 4]');
    process.exit(2);
  }

  const data = JSON.parse(readFileSync(candidatesPath, 'utf8')) as { candidates?: readonly Candidate[] };
  const candidates = (data.candidates ?? []).slice(0, max);

  let fetched = 0;
  let unreachable = 0;
  const subjects = await mapPool(candidates, concurrency, async (candidate) => {
    const snippets: string[] = [];
    if (candidate.summary) snippets.push(`DISCOVERY SUMMARY\n${candidate.summary}`);
    if (candidate.canonicalUrl) {
      const text = await fetchSourceText(candidate.canonicalUrl);
      if (text) {
        fetched += 1;
        snippets.push(`SOURCE ${candidate.canonicalUrl}\n${text}`);
      } else {
        unreachable += 1;
        snippets.push(
          `SOURCE ${candidate.canonicalUrl}\n(page not fetchable at build time; cite only if the discovery summary supports the claim)`,
        );
      }
    }
    return {
      subjectId: candidate.id,
      title: candidate.displayName ?? candidate.id,
      ...(candidate.kind ? { kind: candidate.kind } : {}),
      ...(candidate.summary ? { existingSummary: candidate.summary.slice(0, 400) } : {}),
      sourceSnippets: snippets,
      ...(candidate.lat !== undefined ? { lat: candidate.lat } : {}),
      ...(candidate.lng !== undefined ? { lng: candidate.lng } : {}),
    };
  });

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({ subjects, count: subjects.length, source: candidatesPath }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ subjects: subjects.length, sourcesFetched: fetched, sourcesUnreachable: unreachable, outPath }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
