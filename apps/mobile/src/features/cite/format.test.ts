/**
 * The app's citations are the web's, character for character. This imports the web's own
 * formatter and runs both on the same inputs.
 */
import * as web from '../../../../web/src/lib/citation/format';
import { CITE_ENABLED, citationText } from './cite';
import * as app from './format';

const accessed = new Date('2026-11-23T15:00:00Z');
const cases: app.StyledCitationInput[] = [
  { title: 'John Gilmore Riley House', url: 'https://blackstory.app/entity/x', accessed },
  {
    title: 'The Count',
    url: 'https://blackstory.app/stories/the-count',
    accessed,
    published: new Date('2026-09-18'),
  },
  { title: 'Who counts?', url: 'https://blackstory.app/stories/q', accessed },
  { title: 'A title.', url: 'https://blackstory.app/entity/y', accessed, siteName: 'BlackStory' },
];

describe('citation formats', () => {
  it.each(cases)('match the web for "$title"', (input) => {
    expect(app.formatStyledCitations(input)).toEqual(web.formatStyledCitations(input));
  });

  it('refuses an invalid access date, as the web does', () => {
    const bad = { ...cases[0]!, accessed: new Date('nope') };
    expect(() => app.formatMla(bad)).toThrow();
    expect(() => web.formatMla(bad)).toThrow();
  });
});

describe('Cite on the share sheet', () => {
  it('is off until the owner has reviewed the formats', () => {
    expect(CITE_ENABLED).toBe(false);
  });

  it('shares the three styles as plain text, dated by the page and not the subject', () => {
    const text = citationText(
      {
        title: 'The Count',
        url: 'https://blackstory.app/stories/the-count',
        published: '2026-09-18',
      },
      accessed,
    );
    expect(text).toBe(
      [
        'MLA\n"The Count." BlackStory, 18 Sept. 2026, https://blackstory.app/stories/the-count. Accessed 23 Nov. 2026.',
        'APA\nBlackStory. (2026, September 18). The Count. Retrieved November 23, 2026, from https://blackstory.app/stories/the-count',
        'Chicago\nBlackStory. "The Count." Last modified September 18, 2026. Accessed November 23, 2026. https://blackstory.app/stories/the-count.',
      ].join('\n\n'),
    );
  });

  it('prints n.d. in APA and leaves the date out elsewhere when the page has none', () => {
    const text = citationText(
      { title: 'A record', url: 'https://blackstory.app/entity/a' },
      accessed,
    );
    expect(text).toContain('BlackStory. (n.d.). A record.');
    expect(text).not.toMatch(/Last modified/);
  });
});
