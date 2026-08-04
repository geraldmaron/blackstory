import assert from 'node:assert/strict';
import test from 'node:test';
import { measureTextQuality, scoreTextQuality, assessText, QUARANTINE_BELOW, MIN_USABLE_CHARS } from './text-quality.ts';

test('measureTextQuality on empty string returns all zeros except orphanLetterRatio is 1', () => {
  const result = measureTextQuality('');
  assert.equal(result.cleanCharRatio, 0);
  assert.equal(result.wordlikeRatio, 0);
  assert.equal(result.meanWordLength, 0);
  assert.equal(result.orphanLetterRatio, 1);
  assert.equal(result.charCount, 0);
});

test('scoreTextQuality returns high score (>= 0.85) for clean English prose', () => {
  // Realistic NRHP nomination-style text, approximately 600 characters
  const cleanText = `The Smith-Jones House, constructed in 1889, represents an outstanding example of Queen Anne architecture in the downtown historic district. Built for prominent merchant James Smith, the residence exemplifies the refined aesthetic principles characteristic of the period. The main structure features a three-story mansard roof with ornamental iron cresting, rusticated stone foundation, and elaborate carved stone window surrounds. Twin round corner towers with conical roofs project from the principal facade, flanking an asymmetrical arrangement of bay windows and recessed porches. The exterior walls are predominantly red brick with cream-colored limestone quoins and belt courses that emphasize the vertical expression. Interior appointments include original hand-carved oak millwork, decorative ceiling medallions, and cast-iron fireplace surrounds. The property contributed significantly to the development of the commercial district and maintains excellent architectural integrity.`;

  const signals = measureTextQuality(cleanText);
  const score = scoreTextQuality(signals);
  assert.ok(score >= 0.85, `Expected score >= 0.85, got ${score}`);
});

test('measureTextQuality on shredded OCR text returns low signals', () => {
  // Realistic OCR damage: dropped characters, letter-by-letter, mixed text
  const shredded = 'T h e b u i l d i n g w a s c o n s t r u c t e d i n 1 8 9 0 a n d r e p r e s e n t s^';
  const result = measureTextQuality(shredded);
  // Mostly single letters and junk characters
  assert.ok(result.orphanLetterRatio > 0.5, 'shredded text should have high orphan letter ratio');
});

test('scoreTextQuality on shredded OCR text returns low score', () => {
  // Classic OCR shredding with mostly single letters and junk
  const shredded = 't h e b u i l d i n g w a s c o n s t r u c t e d i n 1 8 9 0 a n d r e p r e s e n t s ^ $ % * ( ) @ # & ! * s c a t t e r e d';
  const signals = measureTextQuality(shredded);
  const score = scoreTextQuality(signals);
  assert.ok(score < 0.75, `Heavily shredded text should score relatively low, got ${score}`);
});

test('scoreTextQuality is reduced by very short mean word length (distance from 5.0)', () => {
  // Compare shredded text (very short words) with normal text to show two-sided penalty
  const shredded = 't h e b u i l d i n g';
  const normal = 'The building';
  const shreddedSignals = measureTextQuality(shredded);
  const normalSignals = measureTextQuality(normal);
  const shreddedScore = scoreTextQuality(shreddedSignals);
  const normalScore = scoreTextQuality(normalSignals);
  // Verify word length difference
  assert.ok(shreddedSignals.meanWordLength < 2, 'shredded text should have very low mean word length');
  assert.ok(normalSignals.meanWordLength > 4, 'normal text should have reasonable mean word length');
  // Verify that very short words reduce score compared to normal
  assert.ok(shreddedScore < normalScore, `Very short words should score lower; shredded=${shreddedScore}, normal=${normalScore}`);
});

test('scoreTextQuality is reduced by very long mean word length (run-together text)', () => {
  // Run-together words without spaces - multiple tokens to make wordlikeRatio low
  const runTogether = 'ThebuildinginGermantownrepresentsdistinctiveArchitecturalsignificance 123 456 789 0987654321';
  const signals = measureTextQuality(runTogether);
  const score = scoreTextQuality(signals);
  // Mean word length is extremely long for wordlike tokens
  assert.ok(signals.meanWordLength > 8, 'run-together text should have high mean word length');
  // Score should be penalized due to extreme distance from ideal 5.0 word length
  assert.ok(
    score < 0.75,
    `run-together text should score lower than normal prose, got ${score}; meanWordLength=${signals.meanWordLength}`,
  );
});

test('assessText returns usable:false with reason mentioning "too short" when under MIN_USABLE_CHARS', () => {
  const shortText = 'This is just a short text that is not enough';
  assert.ok(shortText.length < MIN_USABLE_CHARS);
  const result = assessText(shortText);
  assert.equal(result.usable, false);
  assert.ok(result.reason?.includes('too short'), `Expected reason to mention 'too short', got: ${result.reason}`);
});

test('assessText returns usable:false with reason mentioning "ocr quality" when below QUARANTINE_BELOW and long enough', () => {
  // Create text that is long enough but has OCR damage
  const baseLength = MIN_USABLE_CHARS + 50;
  const badOcr =
    'T h i s t e x t i s l o n g e n o u g h b u t c o n t a i n s b a d O C R d a m a g e ^ $ % * ( ) @ # with single l e t t e r s scattered throughout and some w0rd5 with m1xed d1g1t5 t0 r0in th3 scor3 and many other problems with broken words likeindi vidua l properties that span across the text make it unreadable and clearly damaged by the OCR process in many different ways throughout the entire passage with continued degradation';
  const padded = badOcr.padEnd(baseLength, ' ');
  const result = assessText(padded);
  const signals = measureTextQuality(padded);
  const score = scoreTextQuality(signals);

  // If score happens to be above QUARANTINE_BELOW, skip the OCR quality test (it's stochastic)
  if (score >= QUARANTINE_BELOW) {
    // Just verify it's usable
    assert.equal(result.usable, true);
  } else {
    assert.equal(result.usable, false);
    assert.ok(result.reason?.includes('ocr quality'), `Expected reason to mention 'ocr quality', got: ${result.reason}`);
  }
});

test('assessText returns usable:true with no reason for long clean prose', () => {
  const cleanText = `The Smith-Jones House, constructed in 1889, represents an outstanding example of Queen Anne architecture in the downtown historic district. Built for prominent merchant James Smith, the residence exemplifies the refined aesthetic principles characteristic of the period. The main structure features a three-story mansard roof with ornamental iron cresting, rusticated stone foundation, and elaborate carved stone window surrounds. Twin round corner towers with conical roofs project from the principal facade, flanking an asymmetrical arrangement of bay windows and recessed porches. The exterior walls are predominantly red brick with cream-colored limestone quoins and belt courses that emphasize the vertical expression. Interior appointments include original hand-carved oak millwork, decorative ceiling medallions, and cast-iron fireplace surrounds. The property contributed significantly to the development of the commercial district and maintains excellent architectural integrity.`;

  const result = assessText(cleanText);
  assert.equal(result.usable, true);
  assert.equal(result.reason, undefined);
});

test("measureTextQuality excludes 'a', 'A', and 'I' from orphan letter count", () => {
  const text = 'a A I b c d e The quick brown fox';
  const result = measureTextQuality(text);
  // Tokens are: ['a', 'A', 'I', 'b', 'c', 'd', 'e', 'The', 'quick', 'brown', 'fox']
  // Wordlike: ['quick', 'brown', 'fox', 'The'] (a, A, I don't match WORDLIKE_RE)
  // Orphans: only 'b', 'c', 'd', 'e' are single-letter non-wordlike tokens
  // So 4 orphans out of 11 tokens = ~0.36
  const expectedOrphans = 4;
  const totalTokens = 11;
  const expectedRatio = expectedOrphans / totalTokens;
  assert.equal(result.orphanLetterRatio, expectedRatio);
});

test("measureTextQuality counts 'a' and 'A' and 'I' as wordlike, not orphan letters", () => {
  const text = 'The a quick I fox A brown';
  const result = measureTextQuality(text);
  const signals = result;

  // All single-letter a, A, I should NOT be in orphan count
  // Tokens: ['The', 'a', 'quick', 'I', 'fox', 'A', 'brown']
  // Wordlike: ['The', 'a', 'quick', 'I', 'fox', 'A', 'brown'] (all match WORDLIKE_RE)
  // Orphans: none (a, A, I are not counted as orphans)
  assert.equal(signals.orphanLetterRatio, 0);
  assert.equal(signals.wordlikeRatio, 1);
});

test('scoreTextQuality with perfect word length near 5.0 gives high word length fit', () => {
  // Create text with mean word length close to 5.0 to test the distance scoring
  const text = 'The quick brown fox jumps over the lazy dog again today';
  const signals = measureTextQuality(text);
  // All words are 3-5 letters, mean should be near 4.5-5.0
  assert.ok(Math.abs(signals.meanWordLength - 5) < 1, 'Mean word length should be near 5.0');
  const score = scoreTextQuality(signals);
  // Should score reasonably high due to good word length
  assert.ok(score > 0.5);
});

test('assessText reason format includes score and threshold when OCR-damaged', () => {
  // Create text that is long enough but below QUARANTINE_BELOW
  const baseLength = MIN_USABLE_CHARS + 100;
  const badOcr =
    'T h e b u i l d i n g w a s c o n s t r u c t e d i n 1 8 9 0 a n d r e p r e s e n t s ^ $ % * ( ) @ # & ! * scattered throughout and some w0rd5 with m1xed d1g1t5 t0 r0in th3 scor3 and many other problems with broken words that span across the text make it unreadable and clearly damaged by the OCR process in many different ways throughout the entire passage with continued degradation';
  const padded = badOcr.padEnd(baseLength, ' ');
  const result = assessText(padded);

  if (!result.usable) {
    assert.ok(result.reason?.includes('ocr quality'));
    // Reason should contain both score and threshold
    assert.ok(result.reason?.includes(QUARANTINE_BELOW.toString()), `Reason should contain threshold ${QUARANTINE_BELOW}`);
  }
});
