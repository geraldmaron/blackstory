import { parseStorySlugParam } from './story-params';

describe('parseStorySlugParam', () => {
  it('accepts a published-looking slug and rejects anything else', () => {
    expect(parseStorySlugParam('abraham-lincoln')).toBe('abraham-lincoln');
    expect(parseStorySlugParam(['buying-a-home'])).toBe('buying-a-home');
    for (const bad of ['', '../etc', 'Abraham', 'a--b', 'a/b', undefined, 7, 'x'.repeat(201)]) {
      expect(parseStorySlugParam(bad)).toBeUndefined();
    }
  });
});
