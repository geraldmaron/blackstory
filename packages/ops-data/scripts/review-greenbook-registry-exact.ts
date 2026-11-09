/**
 * Registry-exact reviewer for Green Book listing claims. Writes verdicts in the format
 * session-claim-review-apply.ts reads, with no model in the loop.
 *
 * For each packet it rebuilds the listing's facts from the row as imported in July (name, street
 * address, category, edition, city, state), requires the packet's claim to be exactly the claim
 * those facts produce, and requires the capture text to state all of them. Approvals quote the
 * capture itself (the ledger re-checks every quote word for word). Anything else is a rejection
 * with the reason. Actor: script:registry-exact, which is never the producer.
 *
 * This reviewer only fits a claim a script can check against a structured registry; it is not a
 * substitute for the model reviewer on prose claims.
 *
 * Usage (from repo root, after session-claim-review-prepare.ts):
 *   cd apps/web && set -a && . ./.env.local && set +a && cd - && export DATABASE_SSL=1
 *   node --conditions development --import tsx packages/ops-data/scripts/review-greenbook-registry-exact.ts \
 *     --packets-file=<dir>/packets.jsonl --out=<dir>/verdicts.jsonl
 */
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import {
  listingClaim,
  listingQuotes,
  stateName,
  type ListingFacts,
} from './lib/greenbook-registry.ts';

export const REGISTRY_EXACT_ACTOR = 'script:registry-exact';
const CAPTURE_TEXT_CAP = 100_000;

function flag(name: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= is required`);
  return hit.slice(name.length + 3);
}

type Packet = {
  packetId: string;
  packetHash: string;
  entityId: string;
  claim: { object: string };
  sourceText: string;
};

async function main(): Promise<void> {
  const packets = readFileSync(flag('packets-file'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Packet);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  try {
    await client.query('BEGIN READ ONLY');
    const { rows } = await client.query<{
      id: string;
      display_name: string;
      provenance: Record<string, string | number>;
    }>(
      `SELECT id, display_name, provenance FROM research.landscape_candidates WHERE id = ANY($1)`,
      [[...new Set(packets.map((packet) => packet.entityId))]],
    );
    await client.query('ROLLBACK');
    const byId = new Map(rows.map((row) => [row.id, row]));
    const decided = packets.map((packet) => {
      const base = {
        packetId: packet.packetId,
        packetHash: packet.packetHash,
        reviewerActorId: REGISTRY_EXACT_ACTOR,
      };
      const reject = (why: string) => ({
        ...base,
        decision: 'reject' as const,
        supportReason: `Registry-exact check failed: ${why}.`,
      });
      const row = byId.get(packet.entityId);
      if (!row) return reject('the row is not in research.landscape_candidates');
      const p = row.provenance;
      const facts: ListingFacts = {
        name: row.display_name,
        address: String(p.historicAddress ?? '')
          .split(',')[0]!
          .trim(),
        category: String(p.sourceCategory ?? ''),
        year: Number(p.editionYear),
        city: String(p.sourceCity ?? '').trim(),
        state: stateName(String(p.sourceState ?? '')),
      };
      if (packet.claim.object !== listingClaim(facts))
        return reject('the claim is not the one these listing facts produce');
      const quotes = listingQuotes(packet.sourceText, facts);
      // fetch.ts keeps only the first 100,000 characters of a document. A miss in a capture that
      // long says nothing about the listing, so it gets no verdict instead of a false rejection.
      if (!quotes && packet.sourceText.length >= CAPTURE_TEXT_CAP) return null;
      if (!quotes)
        return reject(
          'the capture does not state this name, address, category and year exactly once',
        );
      const locator =
        facts.year === 1947
          ? 'feature properties in the 1947 geojson'
          : 'row in the 1956 rows array';
      return {
        ...base,
        decision: 'approve' as const,
        fitness: 'strong',
        quotes: quotes.map((exact) => ({ exact, locator })),
        fitnessReason:
          'The source is NYPL’s structured transcription of the printed Green Book listing, the registry that makes this claim.',
        supportReason:
          `The capture states the name, street address, category and ${facts.year} edition for this listing, ` +
          'and the city appears in the same entry; checked by exact match, not by a model.',
      };
    });
    const verdicts = decided.filter((verdict) => verdict !== null);
    writeFileSync(
      flag('out'),
      verdicts.map((verdict) => JSON.stringify(verdict)).join('\n') + '\n',
    );
    const counts = { approve: 0, reject: 0 };
    for (const verdict of verdicts) counts[verdict.decision] += 1;
    console.log(
      JSON.stringify({
        packets: packets.length,
        ...counts,
        noVerdictCaptureTruncated: packets.length - verdicts.length,
      }),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
