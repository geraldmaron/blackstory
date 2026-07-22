/**
 * Re-runs Tier-1 corroboration for existing enrichment subjects without a full
 * LLM re-enrich pass. Reads a subjects JSON file, fetches each primary SOURCE
 * snippet URL (when present), calls findCorroboratingTier1Source, and writes
 * updated corroboratingSourceUrl + snippet text.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/recorroborate-enrichment-subjects.ts \
 *     --subjects .cache/dc-enrichment/batch-02-subjects.json \
 *     --out .cache/dc-enrichment/batch-02-subjects-recorroborated.json \
 *     [--only-missing] [--dry-run] [--max 20] [--concurrency 2] [--ids id1,id2]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { findCorroboratingTier1Source } from './lib/corroborate-source.ts';
import { fetchPage } from './lib/fetch-page.ts';
import { mapPool } from '../../operator-cli/src/map-pool.ts';

type EnrichmentSubject = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly existingSummary?: string;
  readonly existingContext?: string;
  readonly sourceSnippets?: readonly string[];
  readonly corroboratingSourceUrl?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly jurisdictionLabel?: string;
  readonly locationPrecision?: string;
  readonly locationLabel?: string;
};

const SOURCE_SNIPPET_PATTERN = /^SOURCE (https?:\/\/[^\n]+)\n([\s\S]*)$/u;

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parsePrimarySource(
  snippets: readonly string[] | undefined,
): { readonly url: string; readonly text: string } | undefined {
  if (!snippets) return undefined;
  for (const snippet of snippets) {
    const match = snippet.match(SOURCE_SNIPPET_PATTERN);
    if (match) {
      return { url: match[1]!, text: match[2] ?? '' };
    }
  }
  return undefined;
}

function upsertCorroborationSnippet(
  snippets: readonly string[],
  corroboration: { readonly url: string; readonly text: string; readonly method: string },
): readonly string[] {
  const prefix = `INDEPENDENT CORROBORATING SOURCE (via ${corroboration.method}) ${corroboration.url}\n`;
  const withoutExisting = snippets.filter(
    (snippet) =>
      !snippet.startsWith('INDEPENDENT TIER-1 SOURCE') &&
      !snippet.startsWith('INDEPENDENT CORROBORATING SOURCE'),
  );
  return [...withoutExisting, `${prefix}${corroboration.text}`];
}

async function main(): Promise<void> {
  const subjectsPath = readArgFlag('--subjects');
  const outPath = readArgFlag('--out');
  const max = Number(readArgFlag('--max') ?? '9999');
  const concurrency = Number(readArgFlag('--concurrency') ?? '2');
  const onlyMissing = hasFlag('--only-missing');
  const dryRun = hasFlag('--dry-run');
  const idsFilter = readArgFlag('--ids')?.split(',').map((id) => id.trim()).filter(Boolean);

  if (!subjectsPath || !outPath) {
    console.error(
      'Usage: --subjects <subjects.json> --out <out.json> [--only-missing] [--dry-run] [--max N] [--concurrency N] [--ids id1,id2]',
    );
    process.exit(2);
  }

  const data = JSON.parse(readFileSync(subjectsPath, 'utf8')) as {
    subjects?: readonly EnrichmentSubject[];
    source?: string;
  };
  let subjects = [...(data.subjects ?? [])];
  if (idsFilter?.length) {
    const allowed = new Set(idsFilter);
    subjects = subjects.filter((subject) => allowed.has(subject.subjectId));
  }
  if (onlyMissing) {
    subjects = subjects.filter((subject) => !subject.corroboratingSourceUrl);
  }
  subjects = subjects.slice(0, max);

  let attempted = 0;
  let found = 0;
  let unchanged = 0;
  const changes: Array<{
    readonly subjectId: string;
    readonly title: string;
    readonly before?: string;
    readonly after?: string;
    readonly method?: string;
  }> = [];

  const updatedById = new Map<string, EnrichmentSubject>();
  await mapPool(
    subjects,
    async (subject) => {
      attempted += 1;
      const before = subject.corroboratingSourceUrl;
      const primary = parsePrimarySource(subject.sourceSnippets);
      let originalPage: Awaited<ReturnType<typeof fetchPage>>;
      if (primary) {
        originalPage = await fetchPage(primary.url);
      }
      const corroboration = await findCorroboratingTier1Source(subject.title, {
        ...(primary
          ? {
              url: primary.url,
              ...(originalPage
                ? { html: originalPage.html, text: originalPage.text }
                : { text: primary.text }),
            }
          : {}),
      });
      if (!corroboration || corroboration.url === before) {
        unchanged += 1;
        changes.push({ subjectId: subject.subjectId, title: subject.title, before });
        updatedById.set(subject.subjectId, subject);
        return;
      }
      found += 1;
      const nextSnippets = upsertCorroborationSnippet(subject.sourceSnippets ?? [], corroboration);
      const updated: EnrichmentSubject = {
        ...subject,
        sourceSnippets: nextSnippets,
        corroboratingSourceUrl: corroboration.url,
      };
      updatedById.set(subject.subjectId, updated);
      changes.push({
        subjectId: subject.subjectId,
        title: subject.title,
        before,
        after: corroboration.url,
        method: corroboration.method,
      });
    },
    { concurrency },
  );

  const mergedSubjects = (data.subjects ?? []).map(
    (subject) => updatedById.get(subject.subjectId) ?? subject,
  );

  if (!dryRun) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      `${JSON.stringify({ ...data, subjects: mergedSubjects, recorroboratedAt: new Date().toISOString() }, null, 2)}\n`,
    );
  }

  console.log(
    JSON.stringify(
      {
        subjectsPath,
        outPath: dryRun ? undefined : outPath,
        dryRun,
        onlyMissing,
        attempted,
        found,
        unchanged,
        changes: changes.filter((change) => change.after),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
