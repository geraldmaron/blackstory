/**
 * Theme resolution tests — dark-first default behavior.
 */
import { resolveThemeName } from '../index';

describe('resolveThemeName', () => {
  it('selects light only for an explicit light scheme', () => {
    expect(resolveThemeName('light')).toBe('light');
  });

  it('defaults to dark for dark, unspecified, and null', () => {
    expect(resolveThemeName('dark')).toBe('dark');
    expect(resolveThemeName('unspecified')).toBe('dark');
    expect(resolveThemeName(null)).toBe('dark');
    expect(resolveThemeName(undefined)).toBe('dark');
  });
});
