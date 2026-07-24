/**
 * WS4 stage-3: consolidate adversarial verdicts, apply corrections (finalType / direction),
 * and split into the tiered gate:
 *   - publishNow: verdict=accept AND reviewFlag=none
 *   - reviewQueue: verdict=accept AND reviewFlag in {living_person, high_impact, contested}
 *   - rejected: verdict=reject (dropped)
 * Prints the flag breakdown so the publish/hold boundary is decided on real data, and writes
 * publish-edges.json + review-queue.json. Each output edge is normalized to an outgoing entry
 * on its from-side: {fromEntityId, toEntityId, type, reason} (direction stored as outgoing).
 *
 * node --conditions development --import tsx consolidate-verdicts.ts \
 *   --verdict-dir <dir> --out-dir <dir>
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const RELATIONSHIP_TYPES = new Set([
  'located_at', 'occurred_at', 'attended', 'founded', 'employed_by', 'member_of', 'related_to',
  'depicts', 'cites', 'governed_by', 'part_of', 'successor_of', 'caused', 'enabled', 'influenced',
  'participated_in', 'overturned', 'commemorates', 'authored', 'other',
]);

type Verdict = {
  idx?: number;
  fromEntityId: string;
  toEntityId: string;
  verdict: string;
  finalType?: string;
  finalFromEntityId?: string;
  finalToEntityId?: string;
  finalDirection?: string;
  reviewFlag?: string;
  reason?: string;
};
type OutEdge = { fromEntityId: string; toEntityId: string; type: string; reviewFlag: string; reason: string };

function parseArgs(argv: readonly string[]): { verdictDir: string; outDir: string } {
  let verdictDir = resolve('.cache/verify-batches');
  let outDir = resolve('.cache');
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--verdict-dir') verdictDir = resolve(argv[++i] ?? '');
    else if (a === '--out-dir') outDir = resolve(argv[++i] ?? '');
  }
  return { verdictDir, outDir };
}

function bump(m: Map<string, number>, k: string): void { m.set(k, (m.get(k) ?? 0) + 1); }

function main(): void {
  const { verdictDir, outDir } = parseArgs(process.argv.slice(2));
  const files = readdirSync(verdictDir).filter((n) => /^verdict-\d+\.json$/.test(n)).sort();
  const verdicts: Verdict[] = [];
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(join(verdictDir, f), 'utf8')) as { verdicts?: Verdict[] };
    for (const v of parsed.verdicts ?? []) verdicts.push(v);
  }

  const publishNow: OutEdge[] = [];
  const reviewQueue: OutEdge[] = [];
  let rejected = 0;
  const flagBreakdown = new Map<string, number>();
  const badType: Verdict[] = [];

  for (const v of verdicts) {
    if (v.verdict !== 'accept') { rejected += 1; continue; }
    const type = v.finalType ?? '';
    if (!RELATIONSHIP_TYPES.has(type)) { badType.push(v); continue; }
    const from = v.finalFromEntityId ?? v.fromEntityId;
    const to = v.finalToEntityId ?? v.toEntityId;
    if (!from || !to || from === to) { badType.push(v); continue; }
    const flag = v.reviewFlag ?? 'none';
    const edge: OutEdge = { fromEntityId: from, toEntityId: to, type, reviewFlag: flag, reason: v.reason ?? '' };
    if (flag === 'none') publishNow.push(edge);
    else { reviewQueue.push(edge); bump(flagBreakdown, flag); }
  }

  writeFileSync(join(outDir, 'publish-edges.json'), JSON.stringify({ count: publishNow.length, edges: publishNow }, null, 2));
  writeFileSync(join(outDir, 'review-queue.json'), JSON.stringify({ count: reviewQueue.length, edges: reviewQueue }, null, 2));

  const byType = new Map<string, number>();
  for (const e of publishNow) bump(byType, e.type);

  console.log('=== WS4 stage-3: consolidate verdicts + tiered gate ===');
  console.log(`total verdicts: ${verdicts.length} | accepted->publishNow: ${publishNow.length} | accepted->reviewQueue: ${reviewQueue.length} | rejected: ${rejected} | badType/self: ${badType.length}`);
  console.log('review-queue flag breakdown:', Object.fromEntries([...flagBreakdown.entries()].sort((a, b) => b[1] - a[1])));
  console.log('publishNow by type:', Object.fromEntries([...byType.entries()].sort((a, b) => b[1] - a[1])));
  if (badType.length) console.log('badType samples:', badType.slice(0, 5).map((v) => `${v.fromEntityId}->${v.toEntityId}:${v.finalType}`));
  console.log(`\nwrote ${join(outDir, 'publish-edges.json')} and ${join(outDir, 'review-queue.json')}`);
}

main();
