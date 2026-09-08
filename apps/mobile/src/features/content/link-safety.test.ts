/**
 * Adversarial case: external tracking-link rejection / cleaning (MOB-015 requirement #9).
 */
import { isSafeExternalHref, sanitizeExternalHref } from './link-safety';

describe('sanitizeExternalHref', () => {
  it('allows a plain https URL unchanged', () => {
    expect(sanitizeExternalHref('https://example.gov/report.pdf')).toBe('https://example.gov/report.pdf');
  });

  it('allows a plain http URL', () => {
    expect(sanitizeExternalHref('http://example.org/archive')).toBe('http://example.org/archive');
  });

  it('strips a known tracking parameter', () => {
    expect(sanitizeExternalHref('https://example.com/article?utm_source=newsletter&id=42')).toBe(
      'https://example.com/article?id=42',
    );
  });

  it('strips multiple known tracking parameters, keeping legitimate ones', () => {
    const dirty = 'https://example.com/a?gclid=abc&fbclid=def&page=2&msclkid=xyz';
    expect(sanitizeExternalHref(dirty)).toBe('https://example.com/a?page=2');
  });

  it('strips all params and drops the "?" when every param was tracking', () => {
    expect(sanitizeExternalHref('https://example.com/a?utm_source=x&utm_medium=y')).toBe(
      'https://example.com/a',
    );
  });

  it('preserves a hash fragment after stripping tracking params', () => {
    expect(sanitizeExternalHref('https://example.com/a?utm_source=x#section-2')).toBe(
      'https://example.com/a#section-2',
    );
  });

  it('rejects a javascript: URL', () => {
    expect(sanitizeExternalHref('javascript:alert(1)')).toBeNull();
    expect(isSafeExternalHref('javascript:alert(1)')).toBe(false);
  });

  it('rejects a data: URL', () => {
    expect(sanitizeExternalHref('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('rejects a file: URL', () => {
    expect(sanitizeExternalHref('file:///etc/passwd')).toBeNull();
  });

  it('rejects a custom-scheme deep link masquerading as content', () => {
    expect(sanitizeExternalHref('blackstory://entity/whatever')).toBeNull();
  });

  it('rejects a bare/relative path (not an absolute URL)', () => {
    expect(sanitizeExternalHref('/entity/ent_123')).toBeNull();
  });

  it('rejects a protocol-relative URL', () => {
    expect(sanitizeExternalHref('//evil.example.com/x')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(sanitizeExternalHref(undefined)).toBeNull();
    expect(sanitizeExternalHref(null)).toBeNull();
    expect(sanitizeExternalHref(123)).toBeNull();
    expect(sanitizeExternalHref({ href: 'https://example.com' })).toBeNull();
  });

  it('rejects an oversized URL', () => {
    expect(sanitizeExternalHref(`https://example.com/${'a'.repeat(3000)}`)).toBeNull();
  });

  it('rejects an empty or whitespace-only string', () => {
    expect(sanitizeExternalHref('')).toBeNull();
    expect(sanitizeExternalHref('   ')).toBeNull();
  });
});
