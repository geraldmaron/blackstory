/**
 * Commons media dry-run for public entities that already have a stored
 * Wikidata QID and no primaryImage. Metadata only; does not download bytes
 * or write canonical/public rows.
 *
 * Usage (repo root):
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/dry-run-commons-qid-leftover.ts \
 *     --from=.cache/commons-qid-leftover-input.json \
 *     --out=.cache/commons-qid-leftover-dry-run.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createCommonsMediaClient } from '../../domain/src/adapters/wikimedia/commons-media-client.ts';
import { runCommonsMediaEnrichment } from '../../domain/src/adapters/wikimedia/commons-media-enrichment.ts';
import type { EntityMediaEnrichmentInput } from '../../domain/src/adapters/wikimedia/commons-media.ts';

const DIGNITY_CLASSES = new Set([
  'violence_associated',
  'perpetrator_associated',
  'contested_legacy',
  'enslaver_or_segregationist',
]);

type LeftoverRow = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly kind: string;
  readonly living_status: string;
  readonly sensitivity: readonly { readonly class?: string }[];
  readonly wikidata_id: string;
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function dignityHold(row: LeftoverRow): string | undefined {
  if (row.entity_id.startsWith('lynching_')) return 'lynching_prefix';
  const hit = row.sensitivity.find((s) => s.class && DIGNITY_CLASSES.has(s.class));
  if (hit?.class) return hit.class;
  return undefined;
}

const fromPath = resolve(arg('from') ?? '.cache/commons-qid-leftover-input.json');
const outPath = resolve(arg('out') ?? '.cache/commons-qid-leftover-dry-run.json');

const rows = JSON.parse(readFileSync(fromPath, 'utf8')) as LeftoverRow[];
const byId = new Map(rows.map((r) => [r.entity_id, r]));

const entities: EntityMediaEnrichmentInput[] = rows.map((row) => ({
  entityId: row.entity_id,
  displayName: row.display_name,
  kind: row.kind,
  wikidataId: row.wikidata_id,
  hasPrimaryImage: false,
}));

const started = Date.now();
const client = createCommonsMediaClient({ batchDelayMs: 250 });
const result = await runCommonsMediaEnrichment({
  entities,
  client,
  onProgress: (message) => {
    process.stderr.write(`${message}\n`);
  },
});

const byKind = new Map<string, Record<string, number>>();
const autoPeople: unknown[] = [];
const autoAll: unknown[] = [];
let dignityBlockedAuto = 0;

for (const propose of result.proposes) {
  const row = byId.get(propose.entityId);
  const kind = row?.kind ?? 'unknown';
  const bucket = byKind.get(kind) ?? {};
  bucket[propose.outcome] = (bucket[propose.outcome] ?? 0) + 1;
  byKind.set(kind, bucket);

  if (propose.outcome !== 'auto_propose') continue;
  const hold = row ? dignityHold(row) : undefined;
  const enriched = {
    ...propose,
    kind,
    livingStatus: row?.living_status,
    ...(hold !== undefined ? { dignityHold: hold } : {}),
  };
  autoAll.push(enriched);
  if (hold) {
    dignityBlockedAuto += 1;
    continue;
  }
  if (kind === 'person') autoPeople.push(enriched);
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: 'stored-qid-leftover-no-primary-image',
  qidMatchPolicy: 'trusted_identifier_only',
  inputPath: fromPath,
  inputCount: rows.length,
  elapsedMs: Date.now() - started,
  counts: result.counts,
  apiBatches: result.apiBatches,
  byKind: Object.fromEntries(byKind),
  autoProposeAfterDignity: autoAll.length - dignityBlockedAuto,
  dignityBlockedAuto,
  autoProposePeopleAfterDignity: autoPeople.length,
  autoProposePeople: autoPeople,
  autoProposeAll: autoAll,
  proposes: result.proposes,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify(
    {
      outputPath: outPath,
      elapsedMs: payload.elapsedMs,
      counts: result.counts,
      byKind: payload.byKind,
      autoProposeAfterDignity: payload.autoProposeAfterDignity,
      dignityBlockedAuto: payload.dignityBlockedAuto,
      autoProposePeopleAfterDignity: payload.autoProposePeopleAfterDignity,
    },
    null,
    2,
  )}\n`,
);
