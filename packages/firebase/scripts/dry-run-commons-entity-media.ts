/**
 * Dry-run Commons P18 media enrichment against the national catalog fixtures.
 * Resolves QIDs via exact enwiki title match (no LLM), fetches P18 + Commons
 * license metadata in batches, and prints outcome counts. Never uploads bytes
 * or writes Firestore.
 *
 * Usage (from repo root):
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/dry-run-commons-entity-media.ts
 *
 * Optional:
 *   --limit=N          only first N entities
 *   --out=path.json    write full propose list
 *   --sample=N         print N auto_propose samples (default 8)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCommonsMediaClient,
  runCommonsMediaEnrichment,
  type EntityMediaEnrichmentInput,
  type ReleaseSourceEntity,
} from '@repo/domain';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function loadCatalogEntities(limit?: number): EntityMediaEnrichmentInput[] {
  const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json')).sort();
  const entities: EntityMediaEnrichmentInput[] = [];
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as ReleaseSourceEntity[];
    for (const entry of parsed) {
      entities.push({
        entityId: entry.id,
        displayName: entry.displayName,
        kind: entry.kind,
        hasPrimaryImage: false,
      });
    }
  }
  if (limit !== undefined && limit >= 0) {
    return entities.slice(0, limit);
  }
  return entities;
}

async function main(): Promise<void> {
  const limitRaw = arg('limit');
  const limit = limitRaw !== undefined ? Number.parseInt(limitRaw, 10) : undefined;
  const sampleN = Number.parseInt(arg('sample') ?? '8', 10);
  const outPath = arg('out');

  const entities = loadCatalogEntities(
    limit !== undefined && Number.isFinite(limit) ? limit : undefined,
  );
  console.log(`Loaded ${entities.length} national-catalog entities (0 have stored Wikidata QIDs)`);
  console.log('Match policy: exact enwiki title/label only; metadata-only; no image bytes\n');

  const client = createCommonsMediaClient({ batchSize: 50, batchDelayMs: 250 });
  const started = Date.now();
  const result = await runCommonsMediaEnrichment({
    entities,
    client,
    onProgress: (message) => console.log(`  … ${message}`),
  });
  const elapsedMs = Date.now() - started;

  const { counts, apiBatches, proposes } = result;
  console.log('\n=== Commons media dry-run counts ===');
  console.log(`total:                ${counts.total}`);
  console.log(`withQid:              ${counts.withQid}`);
  console.log(`auto_propose:         ${counts.auto_propose}`);
  console.log(`needs_review:         ${counts.needs_review}`);
  console.log(`no_qid:               ${counts.no_qid}`);
  console.log(`qid_ambiguous:        ${counts.qid_ambiguous}`);
  console.log(`no_p18:               ${counts.no_p18}`);
  console.log(`p18_ambiguous:        ${counts.p18_ambiguous}`);
  console.log(`license_unmapped:     ${counts.license_unmapped}`);
  console.log(`missing_credit_or_alt:${counts.missing_credit_or_alt}`);
  console.log(`already_has_image:    ${counts.already_has_image}`);
  console.log(`skipped:              ${counts.skipped}`);
  console.log(`autoProposeRate:      ${(counts.autoProposeRate * 100).toFixed(1)}%`);
  console.log('\n=== Efficiency ===');
  console.log(`titleResolve batches: ${apiBatches.titleResolve}`);
  console.log(`entityClaims batches: ${apiBatches.entityClaims}`);
  console.log(`commonsImageinfo batches: ${apiBatches.commonsImageinfo}`);
  console.log(
    `total API batches:    ${apiBatches.titleResolve + apiBatches.entityClaims + apiBatches.commonsImageinfo}`,
  );
  console.log(`elapsedMs:            ${elapsedMs}`);
  console.log(
    `naive 3-calls/entity: ${entities.length * 3} (avoided via batching + QID dedupe)`,
  );

  const auto = proposes.filter((p) => p.outcome === 'auto_propose');
  console.log(`\n=== Sample auto_propose (up to ${sampleN}) ===`);
  for (const p of auto.slice(0, sampleN)) {
    console.log(
      `- ${p.entityId} | ${p.displayName} | ${p.wikidataId} | ${p.fileTitle} | ${p.rightsStatus} | ${p.licenseShortName}`,
    );
  }

  const byKind = new Map<string, number>();
  for (const p of auto) {
    const entity = entities.find((e) => e.entityId === p.entityId);
    const kind = entity?.kind ?? 'unknown';
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  if (byKind.size > 0) {
    console.log('\n=== auto_propose by kind ===');
    for (const [kind, n] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${kind}: ${n}`);
    }
  }

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          counts,
          apiBatches,
          elapsedMs,
          proposes,
        },
        null,
        2,
      ),
    );
    console.log(`\nWrote ${proposes.length} proposes → ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
