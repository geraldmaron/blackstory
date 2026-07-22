import { hexEquals, sha256Hex, sha256Bytes, utf8Bytes, utf8ByteLength } from './hashing';

describe('sha256 (pure JS)', () => {
  it('matches known-answer vectors', () => {
    // NIST/standard vectors.
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    );
  });

  it('hashes a >64-byte payload correctly (multi-block padding)', () => {
    const long = 'a'.repeat(1000);
    // Precomputed reference digest for 1000 'a's.
    expect(sha256Hex(long)).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });

  it('is stable for identical bytes and differs for different bytes', () => {
    expect(sha256Bytes(utf8Bytes('x'))).toBe(sha256Bytes(utf8Bytes('x')));
    expect(sha256Bytes(utf8Bytes('x'))).not.toBe(sha256Bytes(utf8Bytes('y')));
  });
});

describe('hexEquals', () => {
  it('is case-insensitive and length-checked', () => {
    expect(hexEquals('abcd', 'ABCD')).toBe(true);
    expect(hexEquals('abcd', 'abce')).toBe(false);
    expect(hexEquals('abcd', 'abc')).toBe(false);
  });
});

describe('utf8ByteLength', () => {
  it('counts multibyte characters', () => {
    expect(utf8ByteLength('abc')).toBe(3);
    expect(utf8ByteLength('é')).toBe(2); // U+00E9
    expect(utf8ByteLength('€')).toBe(3); // U+20AC
    expect(utf8ByteLength('😀')).toBe(4); // surrogate pair
  });
});
