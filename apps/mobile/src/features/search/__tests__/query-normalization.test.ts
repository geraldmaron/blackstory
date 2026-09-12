import {
  MAX_QUERY_LENGTH,
  MAX_RAW_INPUT_LENGTH,
  MIN_QUERY_LENGTH,
  foldForComparison,
  getSearchMode,
  normalizeSearchQuery,
} from '../query-normalization';

describe('normalizeSearchQuery — whitespace and control characters', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalizeSearchQuery('   hello   ')).toBe('hello');
  });

  it('collapses runs of internal plain spaces to a single space', () => {
    expect(normalizeSearchQuery('hello     world')).toBe('hello world');
  });

  it('strips ASCII control characters entirely, including tab/newline -- matching server-side normalization byte-for-byte (these are NOT converted to a space)', () => {
    expect(normalizeSearchQuery('hello\tworld')).toBe('helloworld');
    expect(normalizeSearchQuery('hello\nworld')).toBe('helloworld');
  });

  it('strips zero-width and directional-mark characters used to visually disguise input', () => {
    // U+200B zero-width space inserted mid-word.
    const disguised = 'ha​ck';
    expect(normalizeSearchQuery(disguised)).toBe('hack');
  });

  it('strips a byte-order mark', () => {
    expect(normalizeSearchQuery('﻿title')).toBe('title');
  });

  it('returns an empty string for input that is only whitespace/control characters', () => {
    expect(normalizeSearchQuery('    \t  ')).toBe('');
  });
});

describe('normalizeSearchQuery — Unicode confusables / compatibility forms', () => {
  it('NFKC-folds fullwidth Latin characters to their standard-width equivalents', () => {
    // Fullwidth "ABC" (U+FF21 U+FF22 U+FF23) visually resembles "ABC" but is a different script
    // block; NFKC normalization collapses it to standard ASCII.
    const fullwidth = 'ＡＢＣ';
    expect(normalizeSearchQuery(fullwidth)).toBe('ABC');
  });

  it('NFKC-folds a compatibility ligature to its expanded form', () => {
    // U+FB01 LATIN SMALL LIGATURE FI -> "fi"
    expect(normalizeSearchQuery('ﬁre')).toBe('fire');
  });

  it('does NOT merge genuinely different-script homoglyphs (documented limitation)', () => {
    // Cyrillic "а" (U+0430) is a different code point from Latin "a" (U+0061); NFKC does not
    // merge cross-script homoglyphs. This is intentional and documented in the module header --
    // asserting it here pins the behavior rather than silently assuming a stronger guarantee.
    const cyrillicA = 'а';
    expect(normalizeSearchQuery(cyrillicA)).not.toBe('a');
    expect(normalizeSearchQuery(cyrillicA)).toBe(cyrillicA);
  });
});

describe('normalizeSearchQuery — huge paste guards', () => {
  it('caps raw input at MAX_RAW_INPUT_LENGTH before any other processing', () => {
    const huge = 'x'.repeat(MAX_RAW_INPUT_LENGTH + 5000);
    const result = normalizeSearchQuery(huge);
    expect(result.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
  });

  it('truncates a normalized query longer than MAX_QUERY_LENGTH rather than rejecting it outright', () => {
    const long = 'abcde '.repeat(40).trim(); // well over MAX_QUERY_LENGTH once collapsed
    const result = normalizeSearchQuery(long);
    expect(result.length).toBe(MAX_QUERY_LENGTH);
    expect(result).toBe(long.slice(0, MAX_QUERY_LENGTH));
  });

  it('never throws on pathological input (very long, all-control-character, empty)', () => {
    expect(() => normalizeSearchQuery('')).not.toThrow();
    expect(() => normalizeSearchQuery(' '.repeat(10_000))).not.toThrow();
    expect(() => normalizeSearchQuery('a'.repeat(1_000_000))).not.toThrow();
  });
});

describe('normalizeSearchQuery — idempotency (property)', () => {
  const samples = [
    'Harriet Tubman',
    '  spaced   out   text  ',
    'ＡＢＣ fullwidth',
    'ha​ck disguised',
    'x'.repeat(500),
    '',
    '   ',
  ];

  it.each(samples)('normalizing twice equals normalizing once: %j', (sample) => {
    const once = normalizeSearchQuery(sample);
    const twice = normalizeSearchQuery(once);
    expect(twice).toBe(once);
  });
});

describe('foldForComparison', () => {
  it('is case-insensitive for comparison purposes only', () => {
    expect(foldForComparison('Harriet Tubman')).toBe(foldForComparison('HARRIET TUBMAN'));
    expect(foldForComparison('harriet tubman')).toBe(foldForComparison('Harriet Tubman'));
  });
});

describe('getSearchMode — the query threshold gate', () => {
  it(`is "browse" for 0..${MIN_QUERY_LENGTH - 1} characters`, () => {
    expect(getSearchMode('')).toBe('browse');
    for (let n = 1; n < MIN_QUERY_LENGTH; n++) {
      expect(getSearchMode('a'.repeat(n))).toBe('browse');
    }
  });

  it(`is "query" at exactly MIN_QUERY_LENGTH (${MIN_QUERY_LENGTH}) characters and above`, () => {
    expect(getSearchMode('a'.repeat(MIN_QUERY_LENGTH))).toBe('query');
    expect(getSearchMode('a'.repeat(MIN_QUERY_LENGTH + 10))).toBe('query');
  });
});
