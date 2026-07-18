/**
 * One-off data-shape migration (black-book-s4hp): splits each national-catalog fixture entry's
 * legacy `topicTags` array into the controlled-taxonomy fields `topicIds` / `mentionedEntityIds`
 * / `keywords` (see `@blap/domain`'s `splitTopicTags`, packages/domain/src/taxonomy/
 * split-topic-tags.ts, for the routing rules). `campaignIds` has no legacy source and is left
 * untouched by this script.
 *
 * `topicTags` is intentionally LEFT IN PLACE alongside the new fields — both firestore schemas
 * (`publicEntityProjectionSchema`/`publicSearchIndexSchema`) still accept it as a deprecated
 * optional field, and several existing readers (search-index adapters, `mapToneFromTopics`,
 * `EntityTopicTags`) still consume it directly. Removing it here would require updating every
 * one of those call sites in the same pass, which is out of scope for this migration; a future
 * bead can drop it once every reader has migrated to the new fields.
 *
 * Pure data transform, no Firestore access. Idempotent: re-running recomputes the same split
 * from `topicTags` and overwrites the same three fields.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/migrate-topic-taxonomy.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitTopicTags } from '@blap/domain';

const catalogDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/national-catalog');

type CatalogEntry = Record<string, unknown> & {
  readonly id: string;
  readonly topicTags?: readonly string[];
};

function migrateFile(file: string): { entities: number; topicIds: number; mentionedEntityIds: number; keywords: number } {
  const filePath = join(catalogDir, file);
  const entries = JSON.parse(readFileSync(filePath, 'utf8')) as CatalogEntry[];

  let topicIdsTotal = 0;
  let mentionedTotal = 0;
  let keywordsTotal = 0;

  const migrated = entries.map((entry) => {
    const { topicIds, mentionedEntityIds, keywords } = splitTopicTags(entry.topicTags ?? []);
    topicIdsTotal += topicIds.length;
    mentionedTotal += mentionedEntityIds.length;
    keywordsTotal += keywords.length;

    return {
      ...entry,
      topicIds,
      mentionedEntityIds,
      keywords,
    };
  });

  writeFileSync(filePath, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
  return { entities: entries.length, topicIds: topicIdsTotal, mentionedEntityIds: mentionedTotal, keywords: keywordsTotal };
}

function main(): void {
  const files = readdirSync(catalogDir).filter((f) => f.endsWith('.json'));
  let entities = 0;
  let topicIds = 0;
  let mentionedEntityIds = 0;
  let keywords = 0;

  for (const file of files) {
    const result = migrateFile(file);
    entities += result.entities;
    topicIds += result.topicIds;
    mentionedEntityIds += result.mentionedEntityIds;
    keywords += result.keywords;
    console.log(`  ${file}: ${result.entities} entries`);
  }

  console.log(
    `Migrated ${files.length} files, ${entities} entities: ` +
      `${topicIds} topicIds, ${mentionedEntityIds} mentionedEntityIds, ${keywords} keywords.`,
  );
}

main();
