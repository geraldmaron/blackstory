/**
 * Where a content screen returns to when it has no history — a deep link or a cold start.
 *
 * The old fallback treated Methodology as a Stories-origin section, so a reader who opened
 * Methodology from a link and pressed back landed in the narrative tab. Methodology is reference
 * material about how the archive decides; it belongs to More.
 */
import { isNarrativeSection, isSupportingSection, sectionBackFallback } from './sections';

describe('sectionBackFallback', () => {
  it('sends every supporting page back to More', () => {
    for (const routeId of ['about', 'methodology', 'errata', 'privacy', 'terms']) {
      expect(isSupportingSection(routeId)).toBe(true);
      expect(sectionBackFallback(routeId)).toBe('/more');
    }
  });

  it('sends Stories back to the Stories tab', () => {
    expect(isSupportingSection('stories')).toBe(false);
    expect(sectionBackFallback('stories')).toBe('/stories');
  });

  it('knows which sections render as narrative', () => {
    expect(isNarrativeSection('stories')).toBe(true);
    expect(isNarrativeSection('methodology')).toBe(false);
    expect(isNarrativeSection('privacy')).toBe(false);
  });
});
