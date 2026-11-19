import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findProseVoiceIssues, stripQuotedSpans } from './prose-voice.js';

const rules = (text: string) => findProseVoiceIssues(text).map((finding) => finding.rule);

test('clean narrative prose has no findings', () => {
  assert.deepEqual(
    rules('Settlers from Kentucky began arriving in 1877. The town didn’t wait for a railroad.'),
    [],
  );
});

test('an expanded negative contraction is flagged, and its contracted form is not', () => {
  assert.deepEqual(rules('The decision did not produce integrated schools.'), [
    'expanded-contraction',
  ]);
  assert.deepEqual(rules('A camera cannot show who never enrolled.'), ['expanded-contraction']);
  assert.deepEqual(rules('The decision didn’t produce integrated schools.'), []);
});

test('an em dash in narration is flagged; an en dash in a year range is not', () => {
  assert.deepEqual(rules('The Court dismantled it — and the Klan returned.'), ['em-dash']);
  assert.deepEqual(rules('Between 1877–1887 the town grew.'), []);
});

test('quoted testimony is never checked', () => {
  assert.deepEqual(rules('She said, “I do not remember a school — not one.”'), []);
  assert.deepEqual(rules('The form read "persons who cannot read" in 1870.'), []);
  assert.equal(stripQuotedSpans('a “b” c').replace(/\s+/g, ' '), 'a c');
});

test('curly-quote stripping matches the regex it replaced, and stays linear on unclosed marks', () => {
  const viaRegex = (text: string) => text.replace(/“[^”]*”/g, ' ');
  const cases = [
    '',
    'no quotes here',
    '“whole”',
    'a “b” c “d” e',
    '“one” “two”',
    'an unclosed “mark runs to the end',
    'a stray closing” mark, then “a span”',
    'nested “outer “inner” tail” end',
    '“Paragraph one reopens.\n\n“Paragraph two closes.” Narration resumes.',
    '““”“”””',
  ];
  for (const text of cases) assert.equal(stripQuotedSpans(text), viaRegex(text), text);

  const started = performance.now();
  stripQuotedSpans('“'.repeat(200_000));
  assert.ok(performance.now() - started < 1000, 'a run of opening marks must not rescan the text');
});

test('publisher self-reference and page pointers are flagged', () => {
  assert.deepEqual(rules('More of this history is on this site.'), ['self-reference']);
  assert.deepEqual(rules('Compare it with the attendance figures below.'), ['page-pointer']);
  assert.deepEqual(rules('Before reading the percentages, look at the chart.'), ['page-pointer']);
  assert.deepEqual(rules('A congregation has been on this site since 1860.'), []);
  assert.deepEqual(rules('It opened in 1941 on the site of Chambers Hill.'), []);
  // "above" as plain geography is history, not layout.
  assert.deepEqual(rules('The family lived above the store on Beale Street.'), []);
});

test('poster and nomination-form language is flagged; plain uses of the same words are not', () => {
  assert.deepEqual(rules('She was a trailblazer for Black nurses.'), ['stock-phrase']);
  assert.deepEqual(rules('The church served as headquarters for the Selma campaign.'), [
    'stock-phrase',
  ]);
  assert.deepEqual(rules('The avenue was the cultural heart of Black Indianapolis.'), [
    'stock-phrase',
  ]);
  assert.deepEqual(rules('At the heart of the dispute was the deed.'), []);
  assert.deepEqual(rules('Indiana Avenue was the heart of the community.'), ['stock-phrase']);
  assert.deepEqual(rules('He served as mayor from 1868 to 1870.'), []);
});

test("the record keeper's term is flagged in narration, not in names, titles or quotations", () => {
  assert.deepEqual(rules('Negro doctors were barred from white hospitals.'), ['source-term']);
  assert.deepEqual(rules('It was the only high school for Negroes.'), ['source-term']);
  assert.deepEqual(rules('He pitched in the Negro Leagues.'), []);
  assert.deepEqual(rules('He pitched in the Negro leagues through the 1920s.'), []);
  assert.deepEqual(rules("A sign read 'No negroes allowed in this town,' in 1886."), []);
  assert.deepEqual(rules('N.C. Newbold was the state Director of Negro Education.'), []);
  assert.deepEqual(rules('The form asked for "Negro - rapid" as the wording.'), []);
});

test('a split negate-then-correct is flagged', () => {
  assert.deepEqual(rules('He isn’t asking for relief. He’s naming an asset.'), ['negate-correct']);
  assert.deepEqual(rules('The bank wasn’t insured, and depositors lost most of it.'), []);
});

test('a drumbeat of three very short sentences is flagged; initials and abbreviations are not', () => {
  assert.deepEqual(rules('They clear it. They plant it. They live on it.'), ['staccato-run']);
  assert.deepEqual(rules('W. H. Williams ran the pen. Dr. J. M. Morton led the school.'), []);
  assert.deepEqual(rules('Moore, Dr. Isaac E. and Katherine C., House is a building.'), []);
});
