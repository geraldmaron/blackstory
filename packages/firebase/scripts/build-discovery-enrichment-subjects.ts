/**
 * Turns a discover-candidates.ts run-*.json into enrichment-run subjects with
 * REAL fetched source text, instead of the bare one-line discovery summary +
 * an unfetched URL string. The judge can only extract claims it's actually
 * shown — passing it a stub summary and a link it's never read is why the
 * overnight discovery lane's keep rate was low; this closes that gap the
 * same way `build-starter-enrichment-subjects.ts` does for the starter seed.
 *
 * Also looks for one independent Tier-1 corroborating source per candidate
 * (via lib/corroborate-source.ts — the source's own citation trail first,
 * SearXNG search as fallback), so a Wikipedia-only discovery candidate has a
 * real path to building multi-source confidence instead of being capped at
 * whatever one non-Tier-1 source said.
 *
 * Best-effort throughout: a source that fails to fetch (dead link, block,
 * timeout) still produces a subject — its snippet says so explicitly so the
 * judge doesn't treat silence as evidence, and a per-item failure never
 * aborts the batch.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-discovery-enrichment-subjects.ts \
 *     --candidates <run-*.json> --out <subjects.json> [--max 200] [--concurrency 4]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fetchPage } from './lib/fetch-page.ts';
import { findCorroboratingTier1Source } from './lib/corroborate-source.ts';
// Relative import across the package boundary (operator-cli already depends on
// @repo/firebase, so the reverse package.json dependency would cycle).
import { mapPool } from '../../operator-cli/src/map-pool.ts';

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
  let corroborated = 0;
  const subjects = await mapPool(
    candidates,
    async (candidate) => {
      const snippets: string[] = [];
      if (candidate.summary) snippets.push(`DISCOVERY SUMMARY\n${candidate.summary}`);
      let originalPage: Awaited<ReturnType<typeof fetchPage>>;
      if (candidate.canonicalUrl) {
        originalPage = await fetchPage(candidate.canonicalUrl);
        if (originalPage) {
          fetched += 1;
          snippets.push(`SOURCE ${candidate.canonicalUrl}\n${originalPage.text}`);
        } else {
          unreachable += 1;
          snippets.push(
            `SOURCE ${candidate.canonicalUrl}\n(page not fetchable at build time; cite only if the discovery summary supports the claim)`,
          );
        }
      }
      const corroboration = await findCorroboratingTier1Source(candidate.displayName ?? candidate.id, {
        ...(originalPage ? { html: originalPage.html, url: candidate.canonicalUrl } : {}),
      });
      if (corroboration) {
        corroborated += 1;
        snippets.push(
          `INDEPENDENT TIER-1 SOURCE (via ${corroboration.method}) ${corroboration.url}\n${corroboration.text}`,
        );
      }
      return {
        subjectId: candidate.id,
        title: candidate.displayName ?? candidate.id,
        ...(candidate.kind ? { kind: candidate.kind } : {}),
        ...(candidate.summary ? { existingSummary: candidate.summary.slice(0, 400) } : {}),
        sourceSnippets: snippets,
        ...(candidate.lat !== undefined ? { lat: candidate.lat } : {}),
        ...(candidate.lng !== undefined ? { lng: candidate.lng } : {}),
        // Explicit field (not just embedded in the snippet text) so auto-promote can
        // build a real independent evidence lineage without string-parsing snippets.
        ...(corroboration ? { corroboratingSourceUrl: corroboration.url } : {}),
      };
    },
    { concurrency },
  );

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify({ subjects, count: subjects.length, source: candidatesPath }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({ subjects: subjects.length, sourcesFetched: fetched, sourcesUnreachable: unreachable, corroborated, outPath }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
