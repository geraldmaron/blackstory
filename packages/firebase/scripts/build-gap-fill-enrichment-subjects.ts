/**
 * Builds enrichment-run subjects for gap-fill candidates (find-catalog-entity-gaps.ts
 * output): entities discovered only as a name mentioned in another record's
 * claim, with no source page of their own yet. Unlike the starter/discovery
 * lanes, there is no citation URL to start from, so this does the PRIMARY
 * lookup (findAnySource: broad SearXNG search) instead of corroboration —
 * plus a Tier-1-restricted search on top, so a candidate that turns out to
 * have a real federal/state source gets it recorded as `corroboratingSourceUrl`
 * for the confidence-gated auto-promote step, same as every other lane.
 *
 * A candidate with no fetchable source anywhere still produces a subject —
 * its only material is the mention context from the citing record, and the
 * judge will (correctly) send it to needs_evidence rather than fabricate.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/build-gap-fill-enrichment-subjects.ts \
 *     --candidates <gap-fill-*.json> --out <subjects.json> \
 *     [--min-mentions 2] [--max 200] [--concurrency 4]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { findAnySource, findCorroboratingTier1Source } from './lib/corroborate-source.ts';
// Relative import across the package boundary (operator-cli already depends on
// @repo/firebase, so the reverse package.json dependency would cycle).
import { mapPool } from '../../operator-cli/src/map-pool.ts';

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

async function main(): Promise<void> {
  const candidatesPath = readArgFlag('--candidates');
  const outPath = readArgFlag('--out');
  const minMentions = Number(readArgFlag('--min-mentions') ?? '2');
  const max = Number(readArgFlag('--max') ?? '200');
  const concurrency = Number(readArgFlag('--concurrency') ?? '4');
  if (!candidatesPath || !outPath) {
    console.error('Usage: --candidates <gap-fill-*.json> --out <subjects.json> [--min-mentions 2] [--max 200] [--concurrency 4]');
    process.exit(2);
  }

  const data = JSON.parse(readFileSync(candidatesPath, 'utf8')) as { candidates?: readonly GapCandidate[] };
  const candidates = (data.candidates ?? [])
    .filter((candidate) => candidate.gapFill.mentionedByEntityIds.length >= minMentions)
    .slice(0, max);

  let foundSource = 0;
  let foundTier1 = 0;
  let noSource = 0;
  const subjects = await mapPool(
    candidates,
    async (candidate) => {
      const snippets: string[] = [
        `MENTIONED BY ${candidate.gapFill.mentionedByEntityIds.length} catalog record(s), context: ` +
          candidate.gapFill.mentionContexts.join(' | '),
      ];

      // Sequenced, not parallel: primary lookup (Wikipedia API first) gives us a page
      // whose OWN citation trail is checked for Tier-1 corroboration before falling
      // back to a fresh (SearXNG) search — avoids firing two independent, partly
      // redundant lookups per candidate.
      const primary = await findAnySource(candidate.displayName);
      const tier1 = await findCorroboratingTier1Source(candidate.displayName, {
        ...(primary?.html ? { html: primary.html, url: primary.url } : {}),
      });

      if (primary) {
        foundSource += 1;
        snippets.push(`SOURCE (via ${primary.method}) ${primary.url}\n${primary.text}`);
      }
      if (tier1 && tier1.url !== primary?.url) {
        foundTier1 += 1;
        snippets.push(`INDEPENDENT TIER-1 SOURCE (via ${tier1.method}) ${tier1.url}\n${tier1.text}`);
      } else if (tier1) {
        foundTier1 += 1;
      }
      if (!primary && !tier1) {
        noSource += 1;
        snippets.push('(no fetchable source found; judge only from the mention context above — decision should be needs_evidence unless the context alone is sufficient)');
      }

      // Real Wikidata coordinates when the article has any (a specific place/located
      // event) — legitimately absent for an organization/law/movement with no single
      // point; those correctly stay held for human review, not force-geocoded.
      const coordinates = primary?.coordinates ?? tier1?.coordinates;
      return {
        subjectId: candidate.id,
        title: candidate.displayName,
        kind: candidate.kind,
        existingSummary: candidate.summary.slice(0, 400),
        sourceSnippets: snippets,
        ...(tier1 ? { corroboratingSourceUrl: tier1.url } : {}),
        ...(coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : {}),
      };
    },
    { concurrency },
  );

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify({ subjects, count: subjects.length, source: candidatesPath }, null, 2)}\n`);
  console.log(
    JSON.stringify({
      candidatesConsidered: candidates.length,
      totalInFile: (data.candidates ?? []).length,
      minMentions,
      subjectsBuilt: subjects.length,
      foundAnySource: foundSource,
      foundTier1Source: foundTier1,
      noSourceFound: noSource,
      outPath,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
