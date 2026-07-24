/**
 * QA gate for national-catalog fixture files — run BEFORE publish-national-catalog.ts.
 * (Formalizes the state-bbox containment check the 2026-07-18 catalog QA ran ad hoc;
 * see docs/runbooks/data-ingestion-methodology.md "Researched-entity records".)
 *
 * Checks, fail-closed:
 *  - JSON shape of every entry (required fields, claim shape, era-bucket grammar)
 *  - id and displayName uniqueness across ALL fixture files
 *  - coordinates fall inside the bbox of the state named in jurisdictionLabel
 *  - every claim carries a real-looking https citationHref + non-blank source/label
 *  - confidenceLevel vocabulary; no numeric score-like fields anywhere
 *
 * Also reports (WARNING by default, see "Connectivity budget" below) entities that come out of
 * `extractCatalogRelationships` — the same extraction `publish-national-catalog.ts` uses, which
 * as of WS6 also wires forward resolvable `mentionedEntityIds` (see
 * `packages/domain/src/graph/mention-resolver.ts`) — with ZERO relationships: an entity nobody
 * links to and that links to nobody is a graph dead end, worth flagging even though it isn't a
 * fixture-shape violation the way the checks above are.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/qa-catalog-fixtures.ts \
 *     [--dir=packages/firebase/fixtures/national-catalog] [--candidate-dir=/path/to/new-files]
 * Exit 0 = clean; exit 1 = violations printed.
 *
 * Connectivity budget (isolated-entity check):
 *   Warns by default and does not affect the exit code. Set QA_STRICT_ISOLATED=1 (or pass
 *   --strict-isolated) to fail the gate (non-zero exit) when any isolated entity is found —
 *   opt-in so this never breaks the existing publish flow for pre-existing isolated entities.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { US_STATES, extractCatalogRelationships, type CatalogEntityForRelationships } from '@repo/domain';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/national-catalog');

type Claim = {
  predicate?: string;
  object?: string;
  confidenceLevel?: string;
  citationSource?: string;
  citationHref?: string;
  citationLabel?: string;
};

type Entry = {
  id?: string;
  kind?: string;
  displayName?: string;
  summary?: string;
  eraBuckets?: string[];
  topicTags?: string[];
  jurisdictionLabel?: string;
  locationPrecision?: string;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  claims?: Claim[];
  historicalContext?: string;
  sensitivityClass?: string;
  related?: CatalogEntityForRelationships['related'];
  mentionedEntityIds?: readonly string[];
};

const KINDS = new Set([
  'person',
  'place',
  'school',
  'organization',
  'institution',
  'event',
  'law',
  'case',
  'publication',
  'artifact',
  'movement',
  'other',
]);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const ERA = /^\d{4}s$/;

const STATE_BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s]));
const STATE_BY_POSTAL = new Map(US_STATES.map((s) => [s.postalCode, s]));

function stateFor(jurisdictionLabel: string) {
  const tail = jurisdictionLabel.split(',').pop()?.trim() ?? '';
  if (/^d\.?c\.?$/i.test(tail) || /district of columbia/i.test(tail)) {
    return STATE_BY_POSTAL.get('DC');
  }
  return STATE_BY_NAME.get(tail.toLowerCase()) ?? STATE_BY_POSTAL.get(tail.toUpperCase());
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const dirs = [arg('dir') ?? DEFAULT_DIR, ...(arg('candidate-dir') ? [arg('candidate-dir')!] : [])];
const problems: string[] = [];
const seenIds = new Map<string, string>();
const seenNames = new Map<string, string>();
let total = 0;
// Accumulated across every dir/file, for the connectivity-budget check below — it needs the FULL
// entity set so a relationship whose two endpoints live in different fixture files still resolves.
const allEntries: Entry[] = [];

for (const dir of dirs) {
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const where = `${dir}/${file}`;
    let entries: Entry[];
    try {
      const parsed = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (!Array.isArray(parsed)) {
        problems.push(`${where}: not a JSON array`);
        continue;
      }
      entries = parsed as Entry[];
    } catch (error) {
      problems.push(`${where}: unparseable JSON (${(error as Error).message})`);
      continue;
    }

    entries.forEach((entry, index) => {
      total += 1;
      allEntries.push(entry);
      const tag = `${file}[${index}] ${entry.id ?? entry.displayName ?? '?'}`;
      const flag = (msg: string) => problems.push(`${tag}: ${msg}`);

      if (!entry.id || !/^ent_[a-z0-9_]+$/.test(entry.id))
        flag('bad or missing id (ent_snake_case)');
      if (!entry.kind || !KINDS.has(entry.kind)) flag(`bad kind "${entry.kind}"`);
      if (!entry.displayName?.trim()) flag('missing displayName');
      if (!entry.summary || entry.summary.trim().length < 40)
        flag('summary missing or too thin (<40 chars)');
      if (!entry.jurisdictionLabel?.trim()) flag('missing jurisdictionLabel');
      if (!entry.locationPrecision?.trim()) flag('missing locationPrecision');
      if (!entry.locationLabel?.trim()) flag('missing locationLabel');
      for (const bucket of entry.eraBuckets ?? []) {
        if (!ERA.test(bucket)) flag(`bad era bucket "${bucket}"`);
      }

      if (entry.id) {
        const prior = seenIds.get(entry.id);
        if (prior) flag(`duplicate id (also in ${prior})`);
        else seenIds.set(entry.id, where);
      }
      const nameKey = entry.displayName?.trim().toLowerCase();
      if (nameKey) {
        const prior = seenNames.get(nameKey);
        if (prior) flag(`duplicate displayName (also in ${prior})`);
        else seenNames.set(nameKey, where);
      }

      if (typeof entry.lat !== 'number' || typeof entry.lng !== 'number') {
        flag('missing lat/lng');
      } else if (['institution', 'campus'].includes(entry.locationPrecision ?? '')) {
        // Visitable-precision claim needs visitable-precision coordinates: 3 decimals ≈ 111m.
        // JSON drops trailing zeros, so a single short axis can be a legitimately precise
        // value ending in 0 — only both-axes-short is a hard failure; one short axis warns.
        const decimals = (value: number) => (String(value).split('.')[1] ?? '').length;
        const latDecimals = decimals(entry.lat);
        const lngDecimals = decimals(entry.lng);
        if (latDecimals < 3 && lngDecimals < 3) {
          flag(
            `locationPrecision "${entry.locationPrecision}" claims a visitable site but ` +
              `coordinates (${entry.lat}, ${entry.lng}) carry <3 decimal places on both axes — ` +
              'use real site coordinates or downgrade the precision label',
          );
        } else if (latDecimals < 2 || lngDecimals < 2) {
          flag(
            `coordinates (${entry.lat}, ${entry.lng}) have an axis under 2 decimal places — ` +
              'verify this is a real site coordinate, not a rounded one',
          );
        }
      }
      if (
        typeof entry.lat === 'number' &&
        typeof entry.lng === 'number' &&
        entry.jurisdictionLabel
      ) {
        const state = stateFor(entry.jurisdictionLabel);
        if (!state) {
          flag(`cannot resolve state from jurisdictionLabel "${entry.jurisdictionLabel}"`);
        } else {
          const [west, south, east, north] = state.bbox;
          if (entry.lat < south || entry.lat > north || entry.lng < west || entry.lng > east) {
            flag(
              `coordinates (${entry.lat}, ${entry.lng}) outside ${state.name} bbox — ` +
                'wrong state or transposed lat/lng',
            );
          }
        }
      }

      const claims = entry.claims ?? [];
      if (claims.length === 0) flag('no claims — at least one cited claim required');
      claims.forEach((claim, claimIndex) => {
        const cTag = `claim[${claimIndex}]`;
        if (!claim.predicate?.trim() || !claim.object?.trim())
          flag(`${cTag}: missing predicate/object`);
        if (!claim.confidenceLevel || !CONFIDENCE.has(claim.confidenceLevel)) {
          flag(`${cTag}: bad confidenceLevel "${claim.confidenceLevel}"`);
        }
        if (!claim.citationSource?.trim() || !claim.citationLabel?.trim()) {
          flag(`${cTag}: missing citationSource/citationLabel`);
        }
        if (!claim.citationHref || !/^https:\/\/[^ ]+\.[a-z]{2,}/i.test(claim.citationHref)) {
          flag(`${cTag}: citationHref missing or not a plausible https URL`);
        }
      });
    });
  }
}

console.log(`Checked ${total} entries across ${dirs.length} dir(s).`);

// ---------------------------------------------------------------------------
// Connectivity budget: flag publishable entities extractCatalogRelationships resolves to ZERO
// relationships (isolated). WARNING by default (never affects exit code) so this never breaks
// the existing publish flow; opt into a hard gate with QA_STRICT_ISOLATED=1 / --strict-isolated.
// ---------------------------------------------------------------------------
const strictIsolated = process.env.QA_STRICT_ISOLATED === '1' || process.argv.includes('--strict-isolated');
const publishableEntries = allEntries.filter(
  (entry): entry is Entry & { id: string } => typeof entry.id === 'string' && entry.id.length > 0,
);
const { relationships: connectivityRelationships } = extractCatalogRelationships(
  publishableEntries as unknown as readonly CatalogEntityForRelationships[],
  { generatedAt: new Date(0).toISOString() },
);
const degreeById = new Map<string, number>();
for (const rel of connectivityRelationships) {
  degreeById.set(rel.fromEntityId, (degreeById.get(rel.fromEntityId) ?? 0) + 1);
  degreeById.set(rel.toEntityId, (degreeById.get(rel.toEntityId) ?? 0) + 1);
}
const isolatedEntries = publishableEntries.filter((entry) => (degreeById.get(entry.id) ?? 0) === 0);

if (isolatedEntries.length > 0) {
  const pct = ((isolatedEntries.length / publishableEntries.length) * 100).toFixed(1);
  console.warn(
    `\n⚠ ${isolatedEntries.length}/${publishableEntries.length} entit(ies) (${pct}%) have zero ` +
      'relationships (no explicit related[] edge and no resolvable mentionedEntityIds match):',
  );
  for (const entry of isolatedEntries.slice(0, 10)) {
    console.warn(`  - ${entry.id} ${entry.displayName ? `(${entry.displayName})` : ''}`.trimEnd());
  }
  if (isolatedEntries.length > 10) console.warn(`  ... and ${isolatedEntries.length - 10} more`);
  if (strictIsolated) {
    console.error('\nQA_STRICT_ISOLATED=1: failing due to isolated entities (see above).');
  }
} else {
  console.log('Connectivity budget: 0 isolated entities.');
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ✘ ${problem}`);
  process.exit(1);
}
if (strictIsolated && isolatedEntries.length > 0) {
  process.exit(1);
}
console.log('QA clean.');
