/**
 * WS4 stage-1: merge the per-batch proposer outputs, dedup, and STRUCTURALLY validate
 * candidate edges before adversarial verification. Structural checks:
 *   - type is one of the 20 canonical RelationshipType values
 *   - both endpoints exist in the published catalog and from != to
 *   - dedup by (unordered pair + type), keeping the highest-confidence instance
 * Emits a staged edge set + summary (by type, confidence, kind-pair) and prints a spotlight
 * on the Civil Rights cluster so edge quality can be eyeballed before spending on verification.
 *
 * node --conditions development --import tsx merge-validate-candidate-edges.ts \
 *   --proposed-dir <dir> --out <staged.json>
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RELATIONSHIP_TYPES = new Set([
  'located_at', 'occurred_at', 'attended', 'founded', 'employed_by', 'member_of', 'related_to',
  'depicts', 'cites', 'governed_by', 'part_of', 'successor_of', 'caused', 'enabled', 'influenced',
  'participated_in', 'overturned', 'commemorates', 'authored', 'other',
]);
const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const catalogDir = join(scriptDir, '../fixtures/national-catalog');

type Edge = {
  fromEntityId: string;
  toEntityId: string;
  type: string;
  direction?: string;
  confidence?: string;
  rationale?: string;
  evidenceHint?: string;
};

function parseArgs(argv: readonly string[]): { proposedDir: string; outPath: string } {
  let proposedDir = resolve('.cache/candidate-batches');
  let outPath = resolve('.cache/staged-edges.json');
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--proposed-dir') proposedDir = resolve(argv[++i] ?? '');
    else if (a === '--out') outPath = resolve(argv[++i] ?? '');
  }
  return { proposedDir, outPath };
}

function loadCatalog(): Map<string, string> {
  const byId = new Map<string, string>();
  for (const file of readdirSync(catalogDir).filter((n) => n.endsWith('.json'))) {
    const parsed = JSON.parse(readFileSync(join(catalogDir, file), 'utf8')) as { id: string; kind: string }[];
    if (Array.isArray(parsed)) for (const e of parsed) if (e?.id) byId.set(e.id, e.kind);
  }
  return byId;
}

function pairKey(a: string, b: string, type: string): string {
  return a < b ? `${a}|${b}|${type}` : `${b}|${a}|${type}`;
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function main(): void {
  const { proposedDir, outPath } = parseArgs(process.argv.slice(2));
  const kindById = loadCatalog();

  const files = readdirSync(proposedDir).filter((n) => /^proposed-\d+\.json$/.test(n)).sort();
  const raw: Edge[] = [];
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(join(proposedDir, file), 'utf8')) as { edges?: Edge[] };
    for (const e of parsed.edges ?? []) raw.push(e);
  }

  const rejects: { edge: Edge; reason: string }[] = [];
  const kept = new Map<string, Edge>();
  for (const e of raw) {
    if (!e?.fromEntityId || !e?.toEntityId) { rejects.push({ edge: e, reason: 'missing endpoint' }); continue; }
    if (e.fromEntityId === e.toEntityId) { rejects.push({ edge: e, reason: 'self-loop' }); continue; }
    if (!RELATIONSHIP_TYPES.has(e.type)) { rejects.push({ edge: e, reason: `bad type: ${e.type}` }); continue; }
    if (!kindById.has(e.fromEntityId)) { rejects.push({ edge: e, reason: `unknown from: ${e.fromEntityId}` }); continue; }
    if (!kindById.has(e.toEntityId)) { rejects.push({ edge: e, reason: `unknown to: ${e.toEntityId}` }); continue; }
    const key = pairKey(e.fromEntityId, e.toEntityId, e.type);
    const existing = kept.get(key);
    if (!existing || (CONFIDENCE_RANK[e.confidence ?? 'low'] ?? 1) > (CONFIDENCE_RANK[existing.confidence ?? 'low'] ?? 1)) {
      kept.set(key, e);
    }
  }

  const edges = [...kept.values()];
  const byType = new Map<string, number>();
  const byConfidence = new Map<string, number>();
  const byKindPair = new Map<string, number>();
  const uniquePairs = new Set<string>();
  for (const e of edges) {
    bump(byType, e.type);
    bump(byConfidence, e.confidence ?? 'unspecified');
    const ka = kindById.get(e.fromEntityId)!;
    const kb = kindById.get(e.toEntityId)!;
    bump(byKindPair, [ka, kb].sort().join('<->'));
    uniquePairs.add(e.fromEntityId < e.toEntityId ? `${e.fromEntityId}|${e.toEntityId}` : `${e.toEntityId}|${e.fromEntityId}`);
  }

  const sortDesc = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

  writeFileSync(outPath, JSON.stringify({
    totals: { rawProposed: raw.length, structurallyValid: edges.length, uniqueEntityPairs: uniquePairs.size, rejected: rejects.length },
    byType: Object.fromEntries(sortDesc(byType)),
    byConfidence: Object.fromEntries(sortDesc(byConfidence)),
    byKindPair: Object.fromEntries(sortDesc(byKindPair)),
    edges,
  }, null, 2));

  console.log('=== WS4 stage-1: merge + structural validation ===');
  console.log(`raw proposed: ${raw.length} | structurally valid (deduped): ${edges.length} | unique entity pairs: ${uniquePairs.size} | rejected: ${rejects.length}`);
  console.log('by confidence:', Object.fromEntries(sortDesc(byConfidence)));
  console.log('by type:', Object.fromEntries(sortDesc(byType)));
  console.log('top kind-pairs:', Object.fromEntries(sortDesc(byKindPair).slice(0, 12)));
  if (rejects.length) console.log('reject reasons (sample):', rejects.slice(0, 8).map((r) => r.reason));

  // Spotlight: any edge touching a civil-rights-cluster entity, for eyeball QA.
  const spotlight = edges.filter((e) =>
    /king|washington|montgomery|selma|sclc|sncc|civil_rights|birmingham|greensboro|parks|naacp/i.test(
      `${e.fromEntityId} ${e.toEntityId}`,
    ),
  );
  console.log(`\n--- Civil Rights cluster spotlight (${spotlight.length} edges) ---`);
  for (const e of spotlight.slice(0, 25)) {
    console.log(`  [${e.confidence}] ${e.fromEntityId} --${e.type}--> ${e.toEntityId} :: ${e.evidenceHint ?? ''}`.slice(0, 200));
  }
  console.log(`\nwrote staged edges: ${outPath}`);
}

main();
