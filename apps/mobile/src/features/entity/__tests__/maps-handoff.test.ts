/**
 * Unit tests for public-precision maps hand-off URIs and open ordering.
 */
import { Linking, Platform } from 'react-native';
import { buildMapsHandoffUris, openMapsAtPublicAnchor } from '../maps-handoff';

describe('buildMapsHandoffUris', () => {
  it('returns geo first, then platform fallbacks, using the exact public coords', () => {
    const uris = buildMapsHandoffUris(33.749, -84.388);
    expect(uris[0]).toBe('geo:33.749,-84.388');
    expect(uris.some((u) => u.includes('33.749') && u.includes('-84.388'))).toBe(true);
    // Never invents extra decimal precision beyond what was passed.
    expect(uris.every((u) => !u.includes('33.7490'))).toBe(true);
  });

  it('returns an empty list for non-finite coordinates', () => {
    expect(buildMapsHandoffUris(Number.NaN, -84.388)).toEqual([]);
    expect(buildMapsHandoffUris(33.749, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it('prefers Apple Maps before Google on iOS after geo:', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    try {
      const uris = buildMapsHandoffUris(1, 2);
      expect(uris[0]).toBe('geo:1,2');
      expect(uris[1]).toContain('maps.apple.com');
      expect(uris[2]).toContain('google.com/maps');
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: original });
    }
  });
});

describe('openMapsAtPublicAnchor', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('opens the first successful URI and stops', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(true as never);
    const result = await openMapsAtPublicAnchor(33.749, -84.388);
    expect(result).toBe('opened');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('geo:33.749,-84.388');
  });

  it('falls through to the next URI when geo: rejects', async () => {
    const spy = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no geo handler'))
      .mockResolvedValueOnce(true as never);
    const result = await openMapsAtPublicAnchor(33.749, -84.388);
    expect(result).toBe('opened');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('returns unavailable for non-finite coords without calling Linking', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const result = await openMapsAtPublicAnchor(Number.NaN, -84.388);
    expect(result).toBe('unavailable');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns failed when every candidate rejects', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const result = await openMapsAtPublicAnchor(33.749, -84.388);
    expect(result).toBe('failed');
  });
});
