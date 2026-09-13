/**
 * Integrity tests for the map memorial names wall dataset and selection helpers.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEMORIAL_NAMES,
  MEMORIAL_NAMES_PLATE,
  MEMORIAL_NAMES_REQUIRED,
  isMemorialNamePlateEligible,
  memorialNameLabel,
  selectMemorialNames,
} from './memorial-names';

test('memorial names pool is large and fully identified', () => {
  assert.ok(
    MEMORIAL_NAMES.length >= 1000,
    `expected hundreds of names, got ${MEMORIAL_NAMES.length}`,
  );
  for (const entry of MEMORIAL_NAMES) {
    assert.ok(entry.name.trim().length > 0);
    assert.ok(Number.isInteger(entry.year));
    assert.ok(entry.year >= 1800 && entry.year <= 2100);
    assert.ok(
      entry.category === 'police_violence' ||
        entry.category === 'racial_terror' ||
        entry.category === 'state_execution',
    );
  }
});

test('required memorial names are present', () => {
  const names = new Set(MEMORIAL_NAMES.map((entry) => entry.name));
  for (const required of MEMORIAL_NAMES_REQUIRED) {
    assert.ok(names.has(required), `missing required name: ${required}`);
  }
});

test('Nat Turner carries accurate state-execution context', () => {
  const nat = MEMORIAL_NAMES.find((entry) => entry.name === 'Nat Turner');
  assert.ok(nat);
  assert.equal(nat!.category, 'state_execution');
  assert.equal(nat!.year, 1831);
  assert.ok(nat!.place?.toLowerCase().includes('virginia'));
  assert.ok(
    nat!.context?.toLowerCase().includes('rebellion') ||
      nat!.context?.toLowerCase().includes('executed'),
  );
});

test('Trayvon Martin is present as a racial-terror milestone', () => {
  const trayvon = MEMORIAL_NAMES.find((entry) => entry.name === 'Trayvon Martin');
  assert.ok(trayvon);
  assert.equal(trayvon!.category, 'racial_terror');
  assert.equal(trayvon!.year, 2012);
  assert.ok(trayvon!.place?.toLowerCase().includes('sanford'));
});

test('no memorial name carries markup residue', () => {
  // repo-5gyq: one scraped entry shipped as "Matthew Johnson#Shooting_of_Matthew_Johnson)" — a
  // Wikipedia anchor painted verbatim on the wall in handwriting. A memorial cannot render a URL
  // fragment as a person's name. Parenthesised alternate spellings from the source rolls are
  // legitimate and pass; wiki anchors, underscores and unbalanced brackets are not.
  for (const entry of MEMORIAL_NAMES) {
    assert.doesNotMatch(entry.name, /[#_|[\]]/, `markup residue in name: ${entry.name}`);
    const opens = (entry.name.match(/\(/g) ?? []).length;
    const closes = (entry.name.match(/\)/g) ?? []).length;
    assert.equal(opens, closes, `unbalanced parentheses in name: ${entry.name}`);
  }
});

test('George Bush III is not on the wall', () => {
  // repo-5jxh: he had been carried as "killed by law enforcement, 2016, St Louis, Missouri". The
  // contemporaneous record is that on 20 November 2016 he shot a St. Louis sergeant twice in the
  // head, and that he was killed the next morning firing on the officers who found him. A
  // memorial cannot seat him beside the people it memorializes. The open police-shooting
  // datasets this roll draws on record every person police killed, whatever the circumstances,
  // so being in them corroborates that a killing happened and nothing more. See
  // docs/research/police-violence-memorial-names.sources.json.
  const names = new Set(MEMORIAL_NAMES.map((entry) => entry.name));
  assert.equal(names.has('George Bush III'), false);
});

test('Charles Brown and Robert Johnson stay on the wall with their own facts', () => {
  // repo-5jxh: the other two names from the same mislinking. Both are real victims and both stay,
  // unlinked, until each has an entity record of their own. Charles Brown's place was the county
  // seat, Yazoo City; the Justice Department's Notice to Close File names Benton, in Yazoo County.
  const charles = MEMORIAL_NAMES.find((entry) => entry.name === 'Charles Brown');
  assert.ok(charles);
  assert.equal(charles!.year, 1957);
  assert.equal(charles!.place, 'Benton, Mississippi');

  const robert = MEMORIAL_NAMES.find((entry) => entry.name === 'Robert Johnson');
  assert.ok(robert);
  assert.equal(robert!.year, 1934);
  assert.equal(robert!.category, 'racial_terror');
  assert.ok(robert!.place?.includes('Tampa'));
});

test('memorial name keys are unique by name+year', () => {
  const seen = new Set<string>();
  for (const entry of MEMORIAL_NAMES) {
    const key = `${entry.name.toLowerCase()}|${entry.year}`;
    assert.equal(seen.has(key), false, `duplicate ${key}`);
    seen.add(key);
  }
});

test('selectMemorialNames returns a stable non-duplicating window', () => {
  const a = selectMemorialNames('map-stage', 48);
  const b = selectMemorialNames('map-stage', 48);
  assert.deepEqual(a, b);
  assert.equal(a.length, 48);
  const keys = new Set(a.map((entry) => `${entry.name}|${entry.year}`));
  assert.equal(keys.size, 48);
});

test('memorialNameLabel includes person, year, and place when known', () => {
  const withPlace = MEMORIAL_NAMES.find((entry) => entry.place);
  assert.ok(withPlace);
  const label = memorialNameLabel(withPlace!);
  assert.ok(label.includes(withPlace!.name));
  assert.ok(label.includes(String(withPlace!.year)));
  assert.ok(label.includes(withPlace!.place!));
});

test('plate eligibility requires a full name (rejects single-token entries)', () => {
  assert.equal(
    isMemorialNamePlateEligible({ name: 'Adam', year: 1900, category: 'racial_terror' }),
    false,
  );
  assert.equal(
    isMemorialNamePlateEligible({ name: 'Jim', year: 1900, category: 'racial_terror' }),
    false,
  );
  assert.equal(
    isMemorialNamePlateEligible({ name: 'Emmett Till', year: 1955, category: 'racial_terror' }),
    true,
  );
  assert.equal(
    isMemorialNamePlateEligible({
      name: 'Lawson "Nelse" Patton',
      year: 1908,
      category: 'racial_terror',
    }),
    true,
  );
  assert.ok(MEMORIAL_NAMES_PLATE.length < MEMORIAL_NAMES.length);
  assert.ok(MEMORIAL_NAMES_PLATE.length >= 1000);
  for (const entry of MEMORIAL_NAMES_PLATE) {
    assert.ok(isMemorialNamePlateEligible(entry));
  }
});
