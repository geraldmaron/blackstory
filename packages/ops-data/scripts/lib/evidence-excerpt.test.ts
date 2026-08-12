/**
 * Unit tests for relevance-aware excerpting (repo-z57b).
 *
 * The failure this guards is silent and expensive: a drafter handed the front of a 290,000-
 * character nomination sees criteria checkboxes and building inventory, writes a sentence about
 * the nomination form, and it passes the validator because every clause is citable. Nothing
 * downstream can catch that, so it has to be caught here.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ELISION_MARKER, LANE_RELEVANCE_TERMS, excerptForWindow } from './evidence-excerpt.ts';

/** Building-fabric filler, in the register the nominations actually use. */
function fabric(chars: number): string {
  const sentence =
    'The main block is of Flemish bond masonry with a limestone foundation and six-over-six ' +
    'sash windows with stone sills and jack arches of header-stretcher pattern. ';
  return sentence.repeat(Math.ceil(chars / sentence.length)).slice(0, chars);
}

test('a source shorter than the window is handed over whole and marked complete', () => {
  const text = fabric(500);
  const excerpt = excerptForWindow(text, 12_000);
  assert.equal(excerpt.text, text);
  assert.equal(excerpt.complete, true);
  assert.equal(excerpt.omittedChars, 0);
});

test('the history is reached even when it starts far past the window', () => {
  // Big Sink's shape: the lane narrative begins at 27% of the document, which no head slice
  // reaches and no affordable cap increase would reach either.
  const narrative =
    'The African American community at Big Sink established its own church and school after ' +
    'emancipation, and the freedmen who bought land along the pike farmed it for three ' +
    'generations. ';
  const text = `${fabric(40_000)}${narrative}${fabric(40_000)}`;
  const excerpt = excerptForWindow(text, 12_000);

  assert.ok(excerpt.text.includes('freedmen who bought land'), 'the narrative must be reached');
  assert.equal(excerpt.complete, false);
  assert.ok(excerpt.text.includes(ELISION_MARKER), 'the gap must be marked');
  assert.ok(excerpt.text.length <= 12_000, `excerpt is ${excerpt.text.length}, over the cap`);
});

test('the document opening is kept, so the criteria and period framing survive', () => {
  const opening =
    'Old Charles Town Historic District is significant under Criterion A for Ethnic Heritage. ';
  const narrative =
    'The evolving status and influence of the African American community shaped the town from ' +
    'settlement through reconstruction and racial integration. ';
  const text = `${opening}${fabric(30_000)}${narrative}${fabric(30_000)}`;
  const excerpt = excerptForWindow(text, 12_000);
  assert.ok(excerpt.text.startsWith(opening), 'the excerpt must open on the document opening');
  assert.ok(excerpt.text.includes('evolving status and influence'));
});

test('a dense narrative passage outranks an incidental colour word', () => {
  // The regression: "black walnut woodwork" appears first, so document-order selection spends the
  // budget on joinery and never reaches the settlement history.
  const incidental = 'Interior details include black walnut woodwork of paneled presses. ';
  const narrative =
    'The African American residents of the district organized a benevolent society, and the ' +
    'freedmen who settled here after emancipation built the colored school that served the ' +
    'Black community for fifty years. ';
  const text = `${fabric(6_000)}${incidental}${fabric(40_000)}${narrative}${fabric(40_000)}`;
  const excerpt = excerptForWindow(text, 8_000);
  assert.ok(excerpt.text.includes('built the colored school'), 'the narrative must win the budget');
});

test('a caption list repeating one term loses to a narrative using several', () => {
  // Big Sink's measured regression: a photo log saying "slave quarter" down forty caption lines
  // outscored the district's settlement history on raw occurrence count, and the drafter got an
  // index instead of a story.
  const captionLog = Array.from(
    { length: 40 },
    (_, i) => `${i + 1}. Looking NW to slave quarter, with rock wall extended from gable end. `,
  ).join('');
  const narrative =
    'The African American families of the district traced their tenure to emancipation, when the ' +
    'freedmen who had been enslaved on these farms bought land, built a colored school, and ' +
    'sustained it through decades of segregation. ';
  const text = `${fabric(20_000)}${captionLog}${fabric(20_000)}${narrative}${fabric(20_000)}`;
  const excerpt = excerptForWindow(text, 8_000);
  assert.ok(excerpt.text.includes('bought land, built a colored school'), 'narrative must win');
});

test('every excerpted passage is verbatim from the source, so quotes still validate', () => {
  const narrative = 'The freedmen who settled here after emancipation built a school. ';
  const text = `${fabric(20_000)}${narrative}${fabric(20_000)}`;
  const excerpt = excerptForWindow(text, 9_000);
  for (const piece of excerpt.text.split(ELISION_MARKER)) {
    assert.ok(text.includes(piece), 'a passage was altered and would break verbatim citation');
  }
});

test('a document with no lane terms falls back to the head slice and says so', () => {
  const text = fabric(50_000);
  const excerpt = excerptForWindow(text, 12_000);
  assert.equal(excerpt.laneTermScore, 0);
  assert.equal(excerpt.text, text.slice(0, 12_000));
  assert.equal(excerpt.omittedChars, text.length - 12_000);
});

test('laneTermScore counts the whole document, not just the part shown', () => {
  const buried = 'The African American community here endured segregation for a century. ';
  const excerpt = excerptForWindow(`${fabric(100_000)}${buried}`, 4_000);
  assert.ok(excerpt.laneTermScore > 0, 'a term past the window must still be counted');
});

test('the excerpt never exceeds the cap, across a range of caps', () => {
  const narrative = 'The Black community and its freedmen founders endured segregation. ';
  const text = `${fabric(15_000)}${narrative}${fabric(15_000)}${narrative}${fabric(15_000)}`;
  for (const cap of [1_200, 4_000, 8_000, 12_000, 20_000]) {
    const excerpt = excerptForWindow(text, cap);
    assert.ok(excerpt.text.length <= cap, `cap ${cap} produced ${excerpt.text.length} chars`);
  }
});

test('the vocabulary keeps both the phrases and the bare period terms', () => {
  for (const term of ['african american', 'freedmen', 'colored', 'negro', 'black']) {
    assert.ok(LANE_RELEVANCE_TERMS.includes(term), `${term} missing from the vocabulary`);
  }
});
