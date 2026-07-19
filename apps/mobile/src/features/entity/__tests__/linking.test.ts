import { Linking } from 'react-native';
import { isSafeExternalUrl, openExternalLink } from '../linking';

describe('isSafeExternalUrl — allowlist, not denylist', () => {
  it('accepts well-formed http/https URLs', () => {
    expect(isSafeExternalUrl('https://example.org/sources/a')).toBe(true);
    expect(isSafeExternalUrl('http://example.org')).toBe(true);
  });

  it('rejects javascript:, data:, file:, and every other scheme', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('ftp://example.org/file')).toBe(false);
    expect(isSafeExternalUrl('blackstory://entity/abc')).toBe(false);
    expect(isSafeExternalUrl('mailto:a@example.org')).toBe(false);
  });

  it('rejects a scheme obfuscated with an embedded control character', () => {
    expect(isSafeExternalUrl('java\tscript:alert(1)')).toBe(false);
    // Mid-string control character (not merely leading/trailing, which `trim()` legitimately
    // strips as ordinary whitespace) must still be rejected.
    expect(isSafeExternalUrl('https://exa\nmple.org')).toBe(false);
  });

  it('rejects bare paths, protocol-relative, empty, oversized, and non-string values', () => {
    expect(isSafeExternalUrl('/entity/abc')).toBe(false);
    expect(isSafeExternalUrl('//evil.example.com')).toBe(false);
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('https://' + 'a'.repeat(3000))).toBe(false);
    expect(isSafeExternalUrl(undefined)).toBe(false);
    expect(isSafeExternalUrl(42)).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
  });

  it('accepts ordinary leading/trailing whitespace (trimmed) around a safe URL', () => {
    expect(isSafeExternalUrl('  https://example.org  ')).toBe(true);
  });
});

describe('openExternalLink', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('opens a safe URL when online', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const result = await openExternalLink('https://example.org', { isOnline: true });
    expect(result).toBe('opened');
    expect(spy).toHaveBeenCalledWith('https://example.org');
  });

  it('blocks an unsafe URL before ever calling Linking, regardless of connectivity', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const result = await openExternalLink('javascript:alert(1)', { isOnline: true });
    expect(result).toBe('blocked-unsafe-url');
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports offline without calling Linking when the caller is offline', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const result = await openExternalLink('https://example.org', { isOnline: false });
    expect(result).toBe('offline');
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports failure without throwing when Linking.openURL rejects', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const result = await openExternalLink('https://example.org', { isOnline: true });
    expect(result).toBe('failed');
  });
});
