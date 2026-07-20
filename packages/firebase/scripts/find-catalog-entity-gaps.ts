/**
 * Gap-fill: scans published entities' claims for named entities they mention
 * but the catalog doesn't have a record for, closing the graph's dangling
 * references. This is the first slice of the unified research-directive
 * framework — same downstream pipeline as everything else in the corsair
 * fill-out program, just a new front door onto it.
 *
 * Reuses rather than reinvents:
 *  - `buildCatalogMatchIndex` / `classifyLeadAgainstCatalog`
 *    (packages/firebase/scripts/lib/catalog-entity-match.ts) — the SAME
 *    existing-vs-new classifier the corsair triage script already uses, so a
 *    mention of "Tuskegee University" resolves to the real id instead of
 *    spawning a duplicate.
 *  - `createLlmProvider` / `resolveOpenRouterModels`
 *    (packages/operator-cli/src/llm-provider.ts, imported by relative path —
 *    NOT a workspace dependency: operator-cli already depends on
 *    @repo/firebase, so a `@repo/firebase → @repo/operator-cli` package
 *    dependency would cycle. A relative import into the same source file
 *    keeps this a single caller with zero duplication without introducing
 *    that cycle.) — the SAME free-model roster + hybrid Ollama failover the
 *    enrichment pipeline uses, not a second HTTP client.
 *
 * Two outputs, both feeding EXISTING pipelines rather than new ones:
 *  1. `existing_match` mentions patch each source entity's `mentionedEntityIds`
 *     in place, in the same national-catalog fixture files. That field is
 *     exactly what `proposeRelationshipCandidates`
 *     (packages/domain/src/graph/relationship-candidates.ts) reads for its
 *     `mutual_mention` signal — this script is a data producer for the
 *     relationship-backfill workstream (repo-fh8u), not a competing one.
 *  2. `new_candidate` mentions become discovery-candidate.v1-shaped stubs
 *     under packages/firebase/fixtures/discovery-candidates/, so they flow
 *     through the SAME triage → real-source-fetch → judge → auto-promote
 *     loop as every other candidate (see build-discovery-enrichment-subjects.ts,
 *     auto-promote-corsair-keeps.ts). No new "gap candidate" state machine.
 *
 * Dry-run by default: prints a report and writes nothing. --apply writes the
 * mentionedEntityIds patches and the new-candidate fixture.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/find-catalog-entity-gaps.ts [--max 50] [--apply]
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCatalogMatchIndex,
  classifyLeadAgainstCatalog,
  type CatalogEntityRef,
} from './lib/catalog-entity-match.ts';
// Relative imports across the package boundary — see module doc for why.
import { createLlmProvider } from '../../operator-cli/src/llm-provider.ts';
import { mapPool } from '../../operator-cli/src/map-pool.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const catalogDir = join(repoRoot, 'packages/firebase/fixtures/national-catalog');
const discoveryDir = join(repoRoot, 'packages/firebase/fixtures/discovery-candidates');
const reportPath = join(repoRoot, '.cache/entity-gaps/report.json');

type CatalogClaim = {
  readonly predicate?: string;
  readonly object?: string;
  readonly citationHref?: string;
};
type CatalogEntity = CatalogEntityRef & {
  readonly summary?: string;
  readonly historicalContext?: string;
  readonly claims?: readonly CatalogClaim[];
  mentionedEntityIds?: readonly string[];
};

type FileRecord = { readonly path: string; readonly entities: CatalogEntity[] };

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const APPLY = process.argv.includes('--apply');
const MAX_ENTITIES = Number(readArgFlag('--max') ?? '10000');
const CONCURRENCY = Number(readArgFlag('--concurrency') ?? '4');

function loadCatalogFiles(): FileRecord[] {
  const files: FileRecord[] = [];
  for (const name of readdirSync(catalogDir)) {
    if (!name.endsWith('.json')) continue;
    const path = join(catalogDir, name);
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (Array.isArray(parsed)) files.push({ path, entities: parsed });
  }
  return files;
}

type ExtractedMention = {
  readonly name: string;
  readonly kindGuess: string;
  readonly quote: string;
};

const KIND_MAP: Record<string, string> = {
  person: 'person',
  place: 'place',
  institution: 'institution',
  organization: 'organization',
  school: 'school',
  event: 'event',
  law: 'law',
  case: 'case',
  movement: 'movement',
};

function normalizeKindGuess(raw: string | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  return KIND_MAP[key] ?? 'other';
}

/**
 * Deterministic backstop for documenting/custodian agencies and generic-category
 * mentions the free model doesn't reliably exclude despite the prompt saying to —
 * same layered approach as `NON_ENTITY_TITLE` in catalog-entity-match.ts: don't
 * rely on prompt compliance alone when a cheap regex catches the common cases.
 */
const CUSTODIAN_AGENCY_PATTERN =
  /^(national park service|library of congress|national register of historic places|national archives|smithsonian( institution)?|[a-z\s]+\s(historical society|historic preservation office|state archives))$/iu;
const GENERIC_CATEGORY_PATTERN =
  /^(rosenwald school|hbcu|underground railroad|green book|sundown town|plantation|historic district)$/iu;

function isDeterministicNonEntity(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return CUSTODIAN_AGENCY_PATTERN.test(normalized) || GENERIC_CATEGORY_PATTERN.test(normalized);
}

function extractJson(content: string): { mentions?: ExtractedMention[] } {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

const SYSTEM_PROMPT = `You extract named-entity mentions worth their OWN catalog record from Black-history
text for a research pipeline. Return ONLY JSON: { "mentions": [ { "name", "kindGuess", "quote" } ] }.
Only extract a mention that has its OWN documented historical significance the text is actually
asserting — not everything named in passing.
INCLUDE:
- A specific person with a documented role (founder, leader, official) — especially names that read
  like "founded by X" or "led by X".
- A specific named institution/organization/school/business distinct from the subject.
- A specific law, court case, or ordinance.
- A specific dated, documented event (a march, massacre, strike, court ruling) — not a generic
  disaster or weather event unless the text itself frames it as a historically significant episode.
EXCLUDE (do not extract):
- Geography used only to LOCATE the subject (containing county, nearby river, nearest city, state
  name) with no historical claim of its own in the text — e.g. "located in Edgecombe County near the
  Tar River" mentions two places doing pure geographic framing, not asserting either has its own
  documented history.
- Natural disasters/weather (hurricanes, floods) UNLESS the text documents the event itself as
  historically significant to the subject's Black-history record (e.g. its role in a displacement).
- Generic concepts, eras, or movements referred to generically (e.g. "segregation", "the civil rights
  movement" as a category) — only a specific named act/case/organization.
- Generic collective groups with no individual identity ("Union soldiers", "enslaved workers",
  "the community") — extract a NAMED person/organization within the group, not the group noun.
- The custodian/documenting agency itself (National Park Service, Library of Congress, a state
  historical society) when it appears only as "NPS preserves/documents X" — it is the SOURCE citing
  the claim, not a Black-history subject of its own in this context.
- A mainstream company/institution named only as a business counterparty of the subject (an employer,
  buyer, stock-exchange listing, acquirer, alma mater) with no documented Black-history role of its
  own — e.g. "sold the company to Viacom" or "listed on the New York Stock Exchange" does not give
  Viacom or the NYSE their own Black-history significance. Only extract such a name if the text
  itself documents THAT organization's own Black-history role (e.g. an HBCU, a Black-owned bank, a
  segregation-era institution).
- The subject entity itself (the record's own name/aliases).
- A single common word or sentence fragment that is not clearly a proper noun on its own (extraction
  artifacts). If you are not confident the string is a real name, omit it.
When unsure whether a place/geography mention carries its own historical claim, EXCLUDE it — a
missed mention costs nothing; a junk candidate costs a wasted research pass.
kindGuess is one of: person, place, institution, organization, school, event, law, case, movement, other.
quote is the exact short phrase/sentence from the input that mentions it.
If nothing qualifies, return { "mentions": [] }.`;

async function extractMentions(
  provider: ReturnType<typeof createLlmProvider>,
  entity: CatalogEntity,
): Promise<ExtractedMention[]> {
  const text = [
    entity.summary,
    entity.historicalContext,
    ...(entity.claims ?? []).map((claim) => claim.object),
  ]
    .filter(Boolean)
    .join('\n');
  if (!text.trim()) return [];
  try {
    const completion = await provider.complete({
      model: '',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            subjectName: entity.displayName,
            subjectKind: entity.kind,
            text,
          }),
        },
      ],
      maxTokens: 500,
    });
    const parsed = extractJson(completion.content);
    if (!Array.isArray(parsed.mentions)) return [];
    return parsed.mentions
      .filter(
        (mention): mention is ExtractedMention =>
          typeof mention?.name === 'string' && mention.name.trim().length > 0,
      )
      .map((mention) => ({
        name: mention.name.trim(),
        kindGuess: normalizeKindGuess(mention.kindGuess),
        quote: typeof mention.quote === 'string' ? mention.quote.slice(0, 300) : '',
      }));
  } catch (error) {
    console.error(
      `extraction failed for ${entity.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

function slugId(name: string): string {
  return `gap_${name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/gu, '_')
    .replace(/^_|_$/gu, '')
    .slice(0, 60)}`;
}

async function main(): Promise<void> {
  const files = loadCatalogFiles();
  const allEntities = files.flatMap((file) => file.entities);
  // Not every fixture entry carries `aliases` — buildCatalogMatchIndex requires the array.
  const index = buildCatalogMatchIndex(
    allEntities.map((entity) => ({ ...entity, aliases: entity.aliases ?? [] })),
  );
  const provider = createLlmProvider({
    provider: (process.env.EDITORIAL_LLM_PROVIDER as never) ?? 'hybrid',
  });

  const eligible = allEntities
    .filter((entity) => (entity.claims?.length ?? 0) > 0)
    .slice(0, MAX_ENTITIES);
  console.error(
    `scanning ${eligible.length} entities with claims (of ${allEntities.length} total)`,
  );

  const mentionedIdPatches = new Map<string, Set<string>>(); // entityId -> new mentionedEntityIds
  const newCandidatesByNormalizedName = new Map<
    string,
    {
      name: string;
      kindGuess: string;
      mentionedBy: Array<{ entityId: string; quote: string; sourceHref?: string }>;
    }
  >();
  let existingMatchCount = 0;
  let nonEntityCount = 0;
  let processed = 0;

  const mentionsByEntity = await mapPool(eligible, (entity) => extractMentions(provider, entity), {
    concurrency: CONCURRENCY,
    onItemComplete: (_result, _index, total) => {
      processed += 1;
      if (processed % 10 === 0 || processed === total)
        console.error(`  ${processed}/${total} entities scanned`);
    },
  });

  for (let entityIndex = 0; entityIndex < eligible.length; entityIndex += 1) {
    const entity = eligible[entityIndex]!;
    const mentions = mentionsByEntity[entityIndex]!;
    for (const mention of mentions) {
      if (isDeterministicNonEntity(mention.name)) {
        nonEntityCount += 1;
        continue;
      }
      const classification = classifyLeadAgainstCatalog({ title: mention.name, index });
      if (
        classification.kind === 'existing_match' &&
        classification.matchedEntityId !== entity.id
      ) {
        existingMatchCount += 1;
        const set = mentionedIdPatches.get(entity.id) ?? new Set(entity.mentionedEntityIds ?? []);
        set.add(classification.matchedEntityId!);
        mentionedIdPatches.set(entity.id, set);
      } else if (classification.kind === 'new_candidate') {
        const key = classification.coreName.toLowerCase();
        const sourceHref = entity.claims?.find((claim) => claim.citationHref)?.citationHref;
        const existing = newCandidatesByNormalizedName.get(key);
        if (existing) {
          existing.mentionedBy.push({
            entityId: entity.id,
            quote: mention.quote,
            ...(sourceHref ? { sourceHref } : {}),
          });
        } else {
          newCandidatesByNormalizedName.set(key, {
            name: classification.coreName,
            kindGuess: mention.kindGuess,
            mentionedBy: [
              { entityId: entity.id, quote: mention.quote, ...(sourceHref ? { sourceHref } : {}) },
            ],
          });
        }
      } else {
        nonEntityCount += 1;
      }
    }
  }

  const newCandidates = [...newCandidatesByNormalizedName.entries()].map(([, value]) => ({
    id: slugId(value.name),
    kind: value.kindGuess,
    displayName: value.name,
    summary: `Mentioned by ${value.mentionedBy.length} catalog record(s): "${value.mentionedBy[0]!.quote}"`,
    discoveredAt: new Date().toISOString(),
    gapFill: {
      mentionedByEntityIds: value.mentionedBy.map((m) => m.entityId),
      mentionContexts: value.mentionedBy.map((m) => m.quote),
      candidateSourceHrefs: [
        ...new Set(value.mentionedBy.map((m) => m.sourceHref).filter(Boolean)),
      ],
    },
  }));

  const report = {
    entitiesScanned: eligible.length,
    existingMatchMentions: existingMatchCount,
    newCandidateMentions: newCandidates.length,
    nonEntityMentions: nonEntityCount,
    mentionedIdPatchCount: mentionedIdPatches.size,
    newCandidates: newCandidates.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      mentionedBy: c.gapFill.mentionedByEntityIds,
    })),
  };
  console.log(JSON.stringify(report, null, 2));
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({ ...report, newCandidates }, null, 2)}\n`);

  if (!APPLY) {
    console.error(
      '\nDry run — no files written. Re-run with --apply to write mentionedEntityIds patches + new candidates.',
    );
    return;
  }

  for (const file of files) {
    let changed = false;
    for (const entity of file.entities) {
      const patch = mentionedIdPatches.get(entity.id);
      if (patch) {
        const merged = [...new Set([...(entity.mentionedEntityIds ?? []), ...patch])].sort();
        entity.mentionedEntityIds = merged;
        changed = true;
      }
    }
    if (changed) writeFileSync(file.path, `${JSON.stringify(file.entities, null, 2)}\n`);
  }

  if (newCandidates.length > 0) {
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
    const outPath = join(discoveryDir, `gap-fill-${stamp}.json`);
    writeFileSync(
      outPath,
      `${JSON.stringify({ candidates: newCandidates, generatedBy: 'find-catalog-entity-gaps.ts' }, null, 2)}\n`,
    );
    console.error(`wrote ${newCandidates.length} new-candidate stubs → ${outPath}`);
  }

  console.error(
    `Applied: ${mentionedIdPatches.size} entities patched with mentionedEntityIds, ${newCandidates.length} new candidates staged.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
