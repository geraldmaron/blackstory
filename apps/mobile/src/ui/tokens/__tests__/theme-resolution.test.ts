/**
 * Theme resolution tests — system-aware with Archive Paper default.
 */
import { resolveThemeName } from '../index';

describe('resolveThemeName', () => {
  it('selects dark only for an explicit dark scheme', () => {
    expect(resolveThemeName('dark')).toBe('dark');
  });

  it('defaults to light for light, unspecified, and null (no v5 dark-cockpit)', () => {
    expect(resolveThemeName('light')).toBe('light');
    expect(resolveThemeName('unspecified')).toBe('light');
    expect(resolveThemeName(null)).toBe('light');
    expect(resolveThemeName(undefined)).toBe('light');
  });
});
