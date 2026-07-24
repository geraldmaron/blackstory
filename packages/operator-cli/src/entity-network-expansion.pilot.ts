/**
 * Live pilot runner for the entity network expansion engine (repo-xez5.4). Makes real Wikidata
 * API calls (no mocking) against Audre Lorde (Q463319) and reports which of the seven named
 * network items from the beads spec actually surface in her real Wikidata claims.
 *
 * Run with: node --conditions development --import tsx src/entity-network-expansion.pilot.ts
 *
 * This is a report tool only — it does not write to any staging table or database; it prints the
 * `stageNetworkCandidates` row shapes it would emit so a human can review before any real staging
 * write happens.
 */
import { expandEntityNetwork, stageNetworkCandidates, type ExpansionSeed } from './entity-network-expansion.js';

const AUDRE_LORDE: ExpansionSeed = {
  qid: 'Q463319',
  kind: 'person',
  displayName: 'Audre Lorde',
  // No entityId: repo-xez5.12's audit found she is not in bb_canonical.entities as of that audit.
};

const NAMED_TARGETS = [
  'Kitchen Table: Women of Color Press',
  'Combahee River Collective',
  'Barbara Smith',
  'Cherríe Moraga',
  'This Bridge Called My Back',
  'Hunter College',
  'Tougaloo',
  'John Jay College',
  'Spelman',
];

async function main() {
  const candidates = await expandEntityNetwork(AUDRE_LORDE, { depth: 1, maxCandidates: 50 });

  console.log(`\nEntity network expansion pilot — seed: Audre Lorde (${AUDRE_LORDE.qid})`);
  console.log(`Total candidates surfaced: ${candidates.length}\n`);

  for (const c of candidates) {
    const noteSuffix = c.hypothesis.note ? `  [${c.hypothesis.note}]` : '';
    console.log(
      `- ${c.label} (${c.qid}) — ${c.hypothesis.relationshipType} (${c.hypothesis.direction}), ` +
        `via P${c.provenance.map((p) => p.propertyId).join(', P')}${noteSuffix}`,
    );
  }

  console.log('\n--- Named-target coverage check ---');
  for (const target of NAMED_TARGETS) {
    const hit = candidates.find((c) => c.label.toLowerCase().includes(target.toLowerCase()));
    console.log(`${hit ? 'FOUND' : 'MISSING'}: ${target}${hit ? ` -> ${hit.label} (${hit.qid})` : ''}`);
  }

  const staged = await stageNetworkCandidates(AUDRE_LORDE, candidates, 'run_pilot_audre_lorde', async (rows) => {
    console.log(`\n(dry run — not written) Would stage ${rows.length} row(s) to bb_research.landscape_candidates`);
  });
  console.log(`\nSample staged row shape:\n${JSON.stringify(staged[0], null, 2)}`);
}

main().catch((err) => {
  console.error('Pilot run failed:', err);
  process.exitCode = 1;
});
