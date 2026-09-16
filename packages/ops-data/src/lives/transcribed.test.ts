import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTranscribedObservations,
  reconcileTranscriptionPasses,
  type TranscribedFigure,
  type TranscribedFigureFile,
} from './transcribed.ts';

function file(figures: readonly TranscribedFigure[]): TranscribedFigureFile {
  return {
    source: 'Census Bureau, Thirteenth Census 1910, Vol. I, table 42',
    sourceUrl: 'https://www2.census.gov/library/publications/decennial/1910/volume-1/x.pdf',
    table: 'Table 42',
    page: '189-195',
    boundaryVersion: 'us-states-1910',
    datasetVintage: '1913 printed volume',
    figures,
  };
}

const alabamaNegro: TranscribedFigure = {
  metricId: 'lives-urban',
  jurisdictionId: 'state:01',
  referencePeriod: '1910',
  raceEthnicitySlice: 'black',
  estimate: 14.2,
  numerator: 129_000,
  denominator: 908_282,
};

test('a figure becomes an observation carrying its table and page', () => {
  const [observation] = buildTranscribedObservations(file([alabamaNegro]));
  assert.ok(observation);
  assert.equal(observation.metricId, 'lives-urban');
  assert.equal(observation.raceEthnicitySlice, 'black');
  assert.equal(observation.estimate, 14.2);
  assert.equal(observation.metadata.table, 'Table 42, p. 189-195');
  assert.equal(observation.datasetVintage, '1913 printed volume');
  assert.equal(observation.marginOfError, null, 'a printed count carries no margin');
});

test('two passes that agree reconcile to one set of observations', () => {
  const observations = reconcileTranscriptionPasses(file([alabamaNegro]), file([alabamaNegro]));
  assert.equal(observations.length, 1);
});

test('a disagreed cell refuses the whole run and names both readings', () => {
  const misread: TranscribedFigure = { ...alabamaNegro, numerator: 192_000 };
  assert.throws(
    () => reconcileTranscriptionPasses(file([alabamaNegro]), file([misread])),
    (error: Error) => {
      assert.match(error.message, /1 cell\(s\) differ/u);
      assert.match(error.message, /numerator: A=129000 B=192000/u);
      assert.match(error.message, /Do not average, round, or pick a side/u);
      return true;
    },
    'a transposition that both passes find plausible is exactly what this must catch',
  );
});

test('a cell present in only one pass refuses the run', () => {
  const extra: TranscribedFigure = { ...alabamaNegro, jurisdictionId: 'state:13' };
  assert.throws(
    () => reconcileTranscriptionPasses(file([alabamaNegro]), file([alabamaNegro, extra])),
    /only in pass B: 1910\|lives-urban\|state:13\|black/u,
  );
});

test('passes describing different tables are refused before any comparison', () => {
  const other = { ...file([alabamaNegro]), table: 'Table 43' };
  assert.throws(
    () => reconcileTranscriptionPasses(file([alabamaNegro]), other),
    /describe different tables/u,
  );
});

test('a duplicated cell inside one pass is refused', () => {
  assert.throws(
    () => buildTranscribedObservations(file([alabamaNegro, alabamaNegro])),
    /duplicate cell in one pass/u,
  );
});

test('a source without an openable page is refused', () => {
  const unciteable = { ...file([alabamaNegro]), sourceUrl: 'a photocopy in a drawer' };
  assert.throws(() => buildTranscribedObservations(unciteable), /https page a reader can open/u);
});

test('the same cell from the same table keeps one id, so a re-read replaces rather than duplicates', () => {
  const [first] = buildTranscribedObservations(file([alabamaNegro]));
  const [second] = buildTranscribedObservations(file([{ ...alabamaNegro, estimate: 14.3 }]));
  assert.ok(first && second);
  assert.equal(first.id, second.id);
  assert.notEqual(first.contentHash, second.contentHash, 'a changed figure changes the hash');
});
