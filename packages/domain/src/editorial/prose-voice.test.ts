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
  // "above" as plain geography is history, not layout.
  assert.deepEqual(rules('The family lived above the store on Beale Street.'), []);
});
