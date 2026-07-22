import { Share } from 'react-native';
import { buildCanonicalEntityUrl, CANONICAL_WEB_ORIGIN, shareEntity } from '../share';

describe('buildCanonicalEntityUrl', () => {
  it('builds the canonical HTTPS web URL for a valid id', () => {
    expect(buildCanonicalEntityUrl('ent_dunbar_school_001')).toBe(
      `${CANONICAL_WEB_ORIGIN}/entity/ent_dunbar_school_001`,
    );
  });

  it('never builds a URL from an id that fails the shared route validator', () => {
    expect(buildCanonicalEntityUrl('../../etc/passwd')).toBeUndefined();
    expect(buildCanonicalEntityUrl('')).toBeUndefined();
    expect(buildCanonicalEntityUrl('Has Spaces')).toBeUndefined();
  });

  it('is always https, never the app’s own deep-link scheme', () => {
    const url = buildCanonicalEntityUrl('ent_valid_001')!;
    expect(url.startsWith('https://')).toBe(true);
    expect(url).not.toMatch(/^blackstory:/);
  });
});

describe('shareEntity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shares the canonical https URL, never a blackstory:// deep link', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as never);
    const result = await shareEntity('ent_valid_001', 'Valid Entity');
    expect(result).toBe('shared');
    const [payload] = spy.mock.calls[0]!;
    expect(payload.url).toBe('https://blackbook.app/entity/ent_valid_001');
    expect(payload.message).toContain('https://blackbook.app/entity/ent_valid_001');
    expect(payload.url).not.toMatch(/^blackstory:/);
  });

  it('reports invalid-id without calling Share.share for an unvalidatable id', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction } as never);
    const result = await shareEntity('../bad', 'Bad');
    expect(result).toBe('invalid-id');
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports dismissed when the user dismisses the share sheet', async () => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction } as never);
    const result = await shareEntity('ent_valid_001', 'Valid Entity');
    expect(result).toBe('dismissed');
  });

  it('reports unavailable rather than throwing when Share.share rejects', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('unavailable'));
    const result = await shareEntity('ent_valid_001', 'Valid Entity');
    expect(result).toBe('unavailable');
  });
});
