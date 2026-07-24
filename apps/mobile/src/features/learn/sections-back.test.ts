/**
 * Learn section back fallback — More-origin vs Stories-origin tab roots.
 */
import { learnSectionBackFallback, isMoreLearnSection } from './sections';

describe('learnSectionBackFallback', () => {
  it('sends More-origin sections to /more', () => {
    expect(isMoreLearnSection('about')).toBe(true);
    expect(learnSectionBackFallback('about')).toBe('/more');
    expect(learnSectionBackFallback('errata')).toBe('/more');
    expect(learnSectionBackFallback('methodology')).toBe('/learn');
  });

  it('sends Stories-origin sections to /learn', () => {
    expect(isMoreLearnSection('topics')).toBe(false);
    expect(learnSectionBackFallback('topics')).toBe('/learn');
    expect(learnSectionBackFallback('history')).toBe('/learn');
  });
});
