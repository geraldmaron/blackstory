/**
 * Export memorial names + optional entity/map anchors from milestones fixture.
 * Run from repo root:
 *   node apps/mobile/scripts/export-memorial-seed.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const namesPath = resolve(
  here,
  '../../../apps/web/src/components/patterns/memorial-wall/memorial-names.ts',
);
const milestonesPath = resolve(
  here,
  '../../../packages/ops-data/fixtures/national-catalog/memorial-milestones-2026-07-23.json',
);
const outPath = resolve(here, '../src/features/memorial/catalog-seed.json');

function normalizeName(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop middle initials / titles so "Clementa C. Pinckney" matches "Clementa Pinckney". */
function coreTokens(value) {
  return normalizeName(value)
    .split(' ')
    .filter((token) => token.length > 1 && !/^(sr|jr|ii|iii|iv)$/.test(token));
}

function namesMatch(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const ta = coreTokens(a);
  const tb = coreTokens(b);
  if (ta.length < 2 || tb.length < 2) return false;
  // First + last token match (ignores middle names/initials).
  return ta[0] === tb[0] && ta[ta.length - 1] === tb[tb.length - 1];
}

const namesSource = readFileSync(namesPath, 'utf8');
const namesMatchBlock = namesSource.match(/MEMORIAL_NAMES[^=]*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/);
if (!namesMatchBlock) {
  throw new Error('Could not parse MEMORIAL_NAMES from memorial-names.ts');
}
const names = [...namesMatchBlock[1].matchAll(/'((?:\\'|[^'])*)'|"((?:\\"|[^"])*)"/g)].map(
  (m) => (m[1] ?? m[2]).replace(/\\'/g, "'").replace(/\\"/g, '"'),
);

const milestones = JSON.parse(readFileSync(milestonesPath, 'utf8'));
if (!Array.isArray(milestones)) {
  throw new Error('Memorial milestones fixture must be an array');
}

const alphabetical = [...names].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

const entries = alphabetical.map((name) => {
  const hit = milestones.find((row) => typeof row.displayName === 'string' && namesMatch(name, row.displayName));
  if (!hit) {
    return { name };
  }
  const entry = {
    name,
    entityId: hit.id,
  };
  if (typeof hit.locationLabel === 'string' && hit.locationLabel.trim()) {
    entry.locationLabel = hit.locationLabel;
  }
  if (typeof hit.jurisdictionLabel === 'string' && hit.jurisdictionLabel.trim()) {
    entry.placeLabel = hit.jurisdictionLabel;
  }
  if (typeof hit.lat === 'number' && typeof hit.lng === 'number') {
    entry.lat = hit.lat;
    entry.lng = hit.lng;
  }
  if (typeof hit.locationPrecision === 'string') {
    entry.locationPrecision = hit.locationPrecision;
  }
  return entry;
});

const linked = entries.filter((e) => e.entityId).length;
const withCoords = entries.filter((e) => typeof e.lat === 'number').length;

const snapshot = {
  version: 'memorial-seed-2026-07-24',
  generatedAt: new Date().toISOString(),
  incompleteByDesign: true,
  names: entries,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `Wrote ${outPath} (${entries.length} names, ${linked} entity links, ${withCoords} map anchors)`,
);
