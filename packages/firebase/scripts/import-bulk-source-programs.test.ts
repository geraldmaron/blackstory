/**
 * Offline unit tests for the NCES IPEDS HBCU bulk-import lane in
 * `import-bulk-source-programs.ts`. Uses synthetic CSV slices — no network or
 * full IPEDS download required.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalInstitutionName,
  filterActiveHbcuRows,
  isResearchedHbcu,
  normalizeInstitutionName,
  parseIpedsHdCsv,
  projectHbcuCandidates,
  stateFromJurisdictionLabel,
  type IpedsHdRow,
  type ResearchedHbcuKey,
} from './import-bulk-source-programs.ts';

const SAMPLE_CSV = [
  'UNITID,INSTNM,ADDR,CITY,STABBR,ZIP,WEBADDR,HBCU,CYACTIVE,LATITUDE,LONGITUD',
  '110060,"Alabama A & M University","4900 Meridian Street","Normal","AL","35762","www.aamu.edu/",1,1,34.783368,-86.568502',
  '110062,"Inactive HBCU","1 Main","Somewhere","AL","35000","",1,0,33.0,-86.0',
  '131520,"Howard University","2400 Sixth St NW","Washington","DC","20059","www.howard.edu/",1,1,38.922,-77.019',
  '226977,"Lincoln University","820 Chestnut St","Jefferson City","MO","65101","www.lincolnu.edu/",1,1,38.566,-92.169',
  '213598,"Lincoln University","1570 Baltimore Pike","Lincoln University","PA","19352","www.lincoln.edu/",1,1,39.809,-75.928',
  '133650,"Florida Agricultural and Mechanical University","1601 S Martin Luther King Jr Blvd","Tallahassee","FL","32307","www.famu.edu/",1,1,30.425,-84.283',
].join('\n');

const researched: readonly ResearchedHbcuKey[] = [
  { normName: canonicalInstitutionName('Howard University'), state: 'DC' },
  { normName: canonicalInstitutionName('Lincoln University'), state: 'PA' },
  { normName: canonicalInstitutionName('Florida A&M University'), state: 'FL' },
];

test('normalizeInstitutionName collapses A&M and hyphen variants', () => {
  assert.equal(normalizeInstitutionName('Southern University and A&M College'), 'southern university a m college');
  assert.equal(normalizeInstitutionName('LeMoyne-Owen College'), 'lemoyne owen college');
});

test('canonicalInstitutionName maps Florida A&M to IPEDS agricultural name', () => {
  assert.equal(
    canonicalInstitutionName('Florida A&M University'),
    canonicalInstitutionName('Florida Agricultural and Mechanical University'),
  );
});

test('stateFromJurisdictionLabel resolves Washington, D.C. to DC', () => {
  assert.equal(stateFromJurisdictionLabel('Washington, D.C.'), 'DC');
  assert.equal(stateFromJurisdictionLabel('Lincoln University, Pennsylvania'), 'PA');
});

test('parseIpedsHdCsv and filterActiveHbcuRows retain only active HBCU rows', () => {
  const parsed = parseIpedsHdCsv(SAMPLE_CSV);
  assert.equal(parsed.length, 6);
  const active = filterActiveHbcuRows(parsed);
  assert.equal(active.length, 5);
  assert.ok(active.every((row) => row.hbcu && row.cyactive));
});

test('projectHbcuCandidates dedupes researched catalog entries state-aware', () => {
  const rows = filterActiveHbcuRows(parseIpedsHdCsv(SAMPLE_CSV));
  const { candidates, dropped } = projectHbcuCandidates({
    rows,
    researched,
    now: '2026-07-21T00:00:00.000Z',
    sourceUrl: 'https://example.test/ipeds',
  });

  assert.equal(candidates.length, 2);
  assert.deepEqual(
    candidates.map((candidate) => candidate.displayName).sort(),
    ['Alabama A & M University', 'Lincoln University'],
  );
  assert.ok(
    candidates.some((candidate) => candidate.displayName === 'Lincoln University' && candidate.provenance.sourceState === 'MO'),
  );

  const dropReasons = new Map(dropped.map((row) => [row.sourceItemId, row.reason]));
  assert.match(dropReasons.get('131520') ?? '', /already researched/);
  assert.match(dropReasons.get('213598') ?? '', /already researched/);
  assert.match(dropReasons.get('133650') ?? '', /already researched/);
});

test('projectHbcuCandidates maps Firebase discovery fields and NCES provenance', () => {
  const [row] = filterActiveHbcuRows(parseIpedsHdCsv(SAMPLE_CSV));
  assert.ok(row);
  const { candidates } = projectHbcuCandidates({
    rows: [row],
    researched: [],
    now: '2026-07-21T00:00:00.000Z',
    sourceUrl: 'https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip',
  });
  const candidate = candidates[0];
  assert.ok(candidate);
  assert.equal(candidate.id, 'us-ed-hbcu-110060');
  assert.equal(candidate.kind, 'place');
  assert.equal(candidate.researchLaneOnly, true);
  assert.equal(candidate.provenance.sourceId, 'us-ed-hbcu');
  assert.equal(candidate.provenance.ncesInstitutionId, '110060');
  assert.equal(candidate.provenance.sourceItemId, '110060');
  assert.equal(candidate.provenance.sourceState, 'AL');
  assert.equal(candidate.provenance.rights, 'Public domain in the U.S. per NCES/IPEDS; U.S. federal government work');
  assert.equal(candidate.canonicalUrl, 'https://www.aamu.edu/');
});

test('isResearchedHbcu requires matching state when catalog key includes state', () => {
  const lincolnMo: Pick<IpedsHdRow, 'name' | 'state'> = { name: 'Lincoln University', state: 'MO' };
  const lincolnPa: Pick<IpedsHdRow, 'name' | 'state'> = { name: 'Lincoln University', state: 'PA' };
  assert.equal(isResearchedHbcu(lincolnMo, researched), false);
  assert.equal(isResearchedHbcu(lincolnPa, researched), true);
});
