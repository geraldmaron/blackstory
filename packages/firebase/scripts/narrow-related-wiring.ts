/**
 * Narrow related[] wiring after slug remap (repo-ts13 follow-up).
 * Restores prior related[] from git HEAD, keeps new org/campaign entities, remaps
 * slug mentions, then adds ONLY:
 *   - edges for remapped slug targets
 *   - mosaic-person mention edges
 *   - founding ↔ org links
 * Avoids converting every catalog mention into related[] (which floods hubs past the
 * adjacency cap of 25 and drops critical edges like MLK → SCLC).
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_MENTION_TAG_TO_ENTITY_ID,
  extractCatalogRelationships,
  relatedEntriesFromRelationships,
} from '@repo/domain';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CATALOG = join(ROOT, 'packages/firebase/fixtures/national-catalog');

const NEW_IDS = new Set([
  'ent_sclc_001',
  'ent_sncc_001',
  'ent_naacp_001',
  'ent_core_001',
  'ent_mfdp_001',
  'ent_birmingham_campaign_001',
  'ent_freedom_rides_001',
  'ent_freedom_summer_001',
  'ent_little_rock_nine_001',
]);

const FOUNDING_TO_ORG: ReadonlyArray<readonly [string, string]> = [
  ['ent_sclc_founding_001', 'ent_sclc_001'],
  ['ent_sncc_founding_001', 'ent_sncc_001'],
  ['ent_naacp_founding_001', 'ent_naacp_001'],
  ['ent_core_founding_001', 'ent_core_001'],
  ['ent_mfdp_dnc_challenge_001', 'ent_mfdp_001'],
];

type Rel = { id: string; type: string; direction: 'outgoing' | 'incoming' };
type Ent = {
  id: string;
  kind: string;
  mentionedEntityIds?: string[];
  related?: Rel[];
  claims?: unknown;
  [k: string]: unknown;
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.json') && name !== 'denylist.json') out.push(full);
  }
  return out;
}

function infer(sourceKind: string, targetKind: string): Omit<Rel, 'id'> {
  if (sourceKind === 'person' && (targetKind === 'organization' || targetKind === 'institution')) {
    return { type: 'member_of', direction: 'outgoing' };
  }
  if (sourceKind === 'person' && (targetKind === 'event' || targetKind === 'movement')) {
    return { type: 'participated_in', direction: 'outgoing' };
  }
  if (sourceKind === 'place' && targetKind === 'event') {
    return { type: 'occurred_at', direction: 'incoming' };
  }
  if (sourceKind === 'event' && targetKind === 'place') {
    return { type: 'occurred_at', direction: 'outgoing' };
  }
  if (sourceKind === 'case' && targetKind === 'law') {
    return { type: 'related_to', direction: 'outgoing' };
  }
  if (sourceKind === 'organization' && targetKind === 'event') {
    return { type: 'participated_in', direction: 'outgoing' };
  }
  return { type: 'related_to', direction: 'outgoing' };
}

function addRel(entity: Ent, entry: Rel): void {
  const existing = entity.related ?? [];
  if (
    existing.some(
      (r) => r.id === entry.id && r.type === entry.type && r.direction === entry.direction,
    )
  ) {
    return;
  }
  entity.related = [...existing, entry];
}

function main(): void {
  const priorRelated = new Map<string, Rel[]>();
  const files = walk(CATALOG);
  for (const full of files) {
    const gitPath = relative(ROOT, full);
    let priorRaw: string;
    try {
      priorRaw = execSync(`git show HEAD:${gitPath}`, {
        encoding: 'utf8',
        maxBuffer: 20_000_000,
        cwd: ROOT,
      });
    } catch {
      continue;
    }
    const prior = JSON.parse(priorRaw) as Ent[];
    if (!Array.isArray(prior)) continue;
    for (const e of prior) {
      if (e?.related?.length)
        priorRelated.set(
          e.id,
          e.related.map((r) => ({ ...r })),
        );
    }
  }

  const mosaicCredits = readFileSync(
    join(ROOT, 'apps/web/src/components/atmosphere/tile-credits.ts'),
    'utf8',
  );
  const mosaicIds = new Set(
    [...mosaicCredits.matchAll(/entityId:\s*'([^']+)'/g)].map((m) => m[1]!),
  );

  const byId = new Map<string, Ent>();
  const fileMap = new Map<string, Ent[]>();
  for (const full of files) {
    const rel = relative(CATALOG, full);
    const data = JSON.parse(readFileSync(full, 'utf8')) as Ent[];
    if (!Array.isArray(data)) continue;
    fileMap.set(rel, data);
    for (const e of data) byId.set(e.id, e);
  }

  for (const e of byId.values()) {
    const next: string[] = [];
    const seen = new Set<string>();
    for (const raw of e.mentionedEntityIds ?? []) {
      const mapped = LEGACY_MENTION_TAG_TO_ENTITY_ID[raw] ?? raw;
      if (mapped === e.id || seen.has(mapped)) continue;
      seen.add(mapped);
      next.push(mapped);
    }
    e.mentionedEntityIds = next;
  }

  for (const e of byId.values()) {
    if (NEW_IDS.has(e.id)) continue;
    e.related = priorRelated.has(e.id) ? [...priorRelated.get(e.id)!] : [];
  }

  const slugTargets = new Set(Object.values(LEGACY_MENTION_TAG_TO_ENTITY_ID));
  for (const e of byId.values()) {
    for (const mid of e.mentionedEntityIds ?? []) {
      if (!slugTargets.has(mid)) continue;
      const target = byId.get(mid);
      if (!target) continue;
      addRel(e, { id: mid, ...infer(e.kind, target.kind) });
    }
  }

  for (const id of mosaicIds) {
    const e = byId.get(id);
    if (!e || e.kind !== 'person') continue;
    for (const mid of e.mentionedEntityIds ?? []) {
      const target = byId.get(mid);
      if (!target) continue;
      addRel(e, { id: mid, ...infer(e.kind, target.kind) });
    }
  }

  for (const [foundingId, orgId] of FOUNDING_TO_ORG) {
    const founding = byId.get(foundingId);
    const org = byId.get(orgId);
    if (!founding || !org) continue;
    addRel(founding, { id: orgId, type: 'related_to', direction: 'outgoing' });
    addRel(org, { id: foundingId, type: 'related_to', direction: 'outgoing' });
  }

  // Drop person mentions from new orgs/events that would flood hubs as related_to incoming.
  // Keep place/event/org structural links authored on NEW_IDS entities.
  for (const id of NEW_IDS) {
    const e = byId.get(id);
    if (!e) continue;
    e.related = (e.related ?? []).filter((r) => {
      const neighbor = byId.get(r.id);
      if (!neighbor) return false;
      if (neighbor.kind === 'person' && r.type === 'related_to') return false;
      return true;
    });
  }

  for (const [rel, entities] of fileMap) {
    writeFileSync(join(CATALOG, rel), `${JSON.stringify(entities, null, 2)}\n`);
  }

  const { relationships, skipped } = extractCatalogRelationships(
    [...byId.values()].map((e) => ({
      id: e.id,
      claims: e.claims as never,
      related: e.related as never,
    })),
    { generatedAt: new Date().toISOString() },
  );
  const relatedBy = relatedEntriesFromRelationships([...byId.keys()], relationships);
  const mlk = relatedBy.get('ent_martin_luther_king_jr_001') ?? [];
  const sclcOnMlk = mlk.filter((r) => r.id === 'ent_sclc_001');

  const mosaicMissing = [...mosaicIds].filter((id) => {
    const e = byId.get(id);
    return (
      e?.kind === 'person' &&
      (e.mentionedEntityIds?.length ?? 0) > 0 &&
      (e.related?.length ?? 0) === 0
    );
  });
  const slugs = [...byId.values()].flatMap((e) =>
    (e.mentionedEntityIds ?? []).filter((m) => !m.startsWith('ent_')),
  );

  console.log(`relationships=${relationships.length} skipped=${skipped.length}`);
  console.log(`MLK projected=${mlk.length} SCLC on MLK=`, sclcOnMlk);
  console.log(
    `mosaic people missing related=${mosaicMissing.length} slug leftovers=${slugs.length}`,
  );

  if (mosaicMissing.length || slugs.length || sclcOnMlk.length === 0) {
    process.exit(1);
  }
  console.log('OK');
}

main();
