/**
 * Classify Corsair enrichment keeps against the national catalog so we enrich
 * existing entities instead of recreating them. Writes a yield report under
 * `.cache/corsair-triage/` and optionally transitions research cases.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/classify-corsair-keeps-against-catalog.ts
 *   … --apply   # exclude non_entity + existing_match dupes; confirm new published ids
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bulkTransitionAdminResearchCases } from '../../../apps/admin/src/cases/research-case-store.js';
import {
  buildCatalogMatchIndex,
  classifyLeadAgainstCatalog,
  loadCatalogEntitiesFromFixtures,
  type LeadClassification,
} from './lib/catalog-entity-match.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = join(ROOT, '.cache/corsair-triage');
const CATALOG_DIR = join(ROOT, 'packages/firebase/fixtures/national-catalog');
const ACTOR_UID = 'corsair-catalog-dedupe';
const ACTOR_EMAIL = 'corsair-catalog-dedupe@blackstory.local';

type PacketLike = {
  readonly subjectId: string;
  readonly subjectTitle: string;
  readonly decision: string;
  readonly drafts?: { readonly publicSummary?: string };
};

type RunFile = {
  readonly items?: readonly { readonly packet: PacketLike }[];
};

function loadKeeps(): PacketLike[] {
  const paths = [
    join(OUT_DIR, 'enrichment-run.json'),
    join(OUT_DIR, 'enrichment-openrouter-round2.json'),
  ];
  const byId = new Map<string, PacketLike>();
  for (const path of paths) {
    if (!existsSync(path)) continue;
    const run = JSON.parse(readFileSync(path, 'utf8')) as RunFile;
    for (const item of run.items ?? []) {
      if (item.packet.decision !== 'keep') continue;
      byId.set(item.packet.subjectId, item.packet);
    }
  }
  return [...byId.values()];
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  mkdirSync(OUT_DIR, { recursive: true });

  const fixtures = loadCatalogEntitiesFromFixtures(CATALOG_DIR);
  const index = buildCatalogMatchIndex(fixtures);
  const keeps = loadKeeps();

  const rows: Array<LeadClassification & { subjectId: string }> = keeps.map((packet) => {
    const classification = classifyLeadAgainstCatalog({
      title: packet.subjectTitle,
      ...(packet.drafts?.publicSummary !== undefined
        ? { summary: packet.drafts.publicSummary }
        : {}),
      index,
    });
    return { ...classification, subjectId: packet.subjectId };
  });

  const counts = {
    totalKeeps: rows.length,
    existing_match: rows.filter((row) => row.kind === 'existing_match').length,
    new_candidate: rows.filter((row) => row.kind === 'new_candidate').length,
    non_entity: rows.filter((row) => row.kind === 'non_entity').length,
  };

  const byMatchedEntity: Record<string, number> = {};
  for (const row of rows) {
    if (row.kind === 'existing_match' && row.matchedEntityId) {
      byMatchedEntity[row.matchedEntityId] = (byMatchedEntity[row.matchedEntityId] ?? 0) + 1;
    }
  }

  const enrichmentSuggestions = rows
    .filter((row) => row.kind === 'existing_match' && row.matchedEntityId)
    .map((row) => ({
      researchCaseId: row.subjectId,
      title: row.title,
      matchedEntityId: row.matchedEntityId,
      matchedDisplayName: row.matchedDisplayName,
      matchMethod: row.matchMethod,
      action: 'enrich_existing',
      hint: row.enrichmentHint,
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    catalogEntityCount: fixtures.length,
    counts,
    topExistingCollisions: Object.entries(byMatchedEntity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([entityId, count]) => ({ entityId, count })),
    enrichmentSuggestions,
    rows,
  };

  writeFileSync(join(OUT_DIR, 'catalog-dedupe-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT_DIR, 'enrichment-suggestions-existing.json'),
    JSON.stringify(
      { suggestions: enrichmentSuggestions, count: enrichmentSuggestions.length },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry_run',
          ...counts,
          topExistingCollisions: report.topExistingCollisions.slice(0, 10),
          reportPath: join(OUT_DIR, 'catalog-dedupe-report.json'),
        },
        null,
        2,
      ),
    );
    return;
  }

  const excludeNonEntity = rows
    .filter((row) => row.kind === 'non_entity')
    .map((row) => row.subjectId);
  const excludeExisting = rows
    .filter((row) => row.kind === 'existing_match')
    .map((row) => row.subjectId);
  // Park thin local/person leads that still need stronger place-first evidence.
  const parkNew = rows.filter((row) => row.kind === 'new_candidate').map((row) => row.subjectId);

  let excluded = 0;
  let parked = 0;
  const errors: { caseId: string; error: string }[] = [];

  for (const batch of chunk(excludeNonEntity, 40)) {
    if (batch.length === 0) continue;
    const result = await bulkTransitionAdminResearchCases({
      caseIds: batch,
      request: {
        action: 'exclude',
        reason:
          'Catalog dedupe: list/index/guide/tour page — not a place-first entity. Prefer related leads from entity stories instead.',
        reasonCode: 'outside_scope',
      },
      actorUid: ACTOR_UID,
      actorEmail: ACTOR_EMAIL,
    });
    excluded += result.succeeded;
    for (const err of result.errors) errors.push({ caseId: err.caseId, error: err.error });
  }

  for (const batch of chunk(excludeExisting, 40)) {
    if (batch.length === 0) continue;
    const result = await bulkTransitionAdminResearchCases({
      caseIds: batch,
      request: {
        action: 'exclude',
        reason:
          'Catalog dedupe: matches an existing public catalog entity — enrich that entityId instead of creating a duplicate.',
        reasonCode: 'duplicate_case',
      },
      actorUid: ACTOR_UID,
      actorEmail: ACTOR_EMAIL,
    });
    excluded += result.succeeded;
    for (const err of result.errors) errors.push({ caseId: err.caseId, error: err.error });
  }

  for (const batch of chunk(parkNew, 40)) {
    if (batch.length === 0) continue;
    const result = await bulkTransitionAdminResearchCases({
      caseIds: batch,
      request: {
        action: 'needs_evidence',
        reason:
          'Catalog dedupe: possible new entity but needs stronger independent sources and place pin before catalog authorship.',
        reasonCode: 'insufficient_source_evidence',
      },
      actorUid: ACTOR_UID,
      actorEmail: ACTOR_EMAIL,
    });
    parked += result.succeeded;
    for (const err of result.errors) errors.push({ caseId: err.caseId, error: err.error });
  }

  const applySummary = {
    mode: 'apply',
    ...counts,
    excluded,
    parked,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
  };
  writeFileSync(join(OUT_DIR, 'catalog-dedupe-apply.json'), JSON.stringify(applySummary, null, 2));
  console.log(JSON.stringify(applySummary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
