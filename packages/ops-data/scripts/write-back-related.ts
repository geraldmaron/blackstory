/**
 * WS5: write accepted edges back into the national-catalog fixtures as inline `related[]`
 * entries (git-durable authoring). Each edge {from, to, type} becomes an OUTGOING entry
 * {id: to, type, direction: 'outgoing'} on the FROM entity, deduped against existing entries.
 * Firestore is populated later by re-running publish-national-catalog.ts (not here).
 *
 * node --conditions development --import tsx write-back-related.ts --edges <publish-edges.json>
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

type Edge = { fromEntityId: string; toEntityId: string; type: string };
type Related = { id: string; type: string; direction: string };
type Entity = { id: string; related?: Related[] };

function parseArgs(argv: readonly string[]): { edgesPath: string } {
  let edgesPath = resolve('.cache/publish-edges.json');
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--edges') edgesPath = resolve(argv[++i] ?? '');
  return { edgesPath };
}

function main(): void {
  const { edgesPath } = parseArgs(process.argv.slice(2));
  const { edges } = JSON.parse(readFileSync(edgesPath, 'utf8')) as { edges: Edge[] };

  // Group edges by from-entity.
  const byFrom = new Map<string, Edge[]>();
  for (const e of edges) {
    const list = byFrom.get(e.fromEntityId) ?? [];
    list.push(e);
    byFrom.set(e.fromEntityId, list);
  }

  const files = readdirSync(catalogDir).filter((n) => n.endsWith('.json'));
  let entitiesModified = 0;
  let edgesAdded = 0;
  let edgesDuplicate = 0;
  const placedFrom = new Set<string>();

  for (const file of files) {
    const path = join(catalogDir, file);
    const arr = JSON.parse(readFileSync(path, 'utf8')) as Entity[];
    if (!Array.isArray(arr)) continue;
    let fileChanged = false;
    for (const entity of arr) {
      const outgoing = byFrom.get(entity.id);
      if (!outgoing) continue;
      placedFrom.add(entity.id);
      const related = entity.related ?? [];
      const seen = new Set(related.map((r) => `${r.id}|${r.type}|${r.direction}`));
      let addedForEntity = 0;
      for (const e of outgoing) {
        const entry: Related = { id: e.toEntityId, type: e.type, direction: 'outgoing' };
        const key = `${entry.id}|${entry.type}|${entry.direction}`;
        if (seen.has(key)) { edgesDuplicate += 1; continue; }
        related.push(entry);
        seen.add(key);
        addedForEntity += 1;
        edgesAdded += 1;
      }
      if (addedForEntity > 0) {
        entity.related = related;
        fileChanged = true;
        entitiesModified += 1;
      }
    }
    if (fileChanged) writeFileSync(path, `${JSON.stringify(arr, null, 2)}\n`);
  }

  const missingFrom = [...byFrom.keys()].filter((id) => !placedFrom.has(id));
  console.log('=== WS5 write-back ===');
  console.log(`edges to place: ${edges.length} | added: ${edgesAdded} | already-present: ${edgesDuplicate} | entities modified: ${entitiesModified}`);
  if (missingFrom.length) console.log(`WARN from-entities not found in fixtures (${missingFrom.length}):`, missingFrom.slice(0, 10));
}

main();
