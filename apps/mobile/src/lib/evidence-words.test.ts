import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { evidenceLabel, evidenceMeterLabel } from './evidence-words';

describe('evidence grade in words', () => {
  it('never prints a letter grade', () => {
    for (const tier of ['high', 'medium', 'low', 'unrated', 'anything']) {
      expect(evidenceLabel(tier, 3)).not.toMatch(/Grade [ABC]|\b[ABC]\b/);
      expect(evidenceMeterLabel(tier, 3)).not.toMatch(/grade [ABC]|\b[ABC]\b/);
    }
  });

  it('says the source count only when it is known', () => {
    expect(evidenceLabel('high', 2)).toBe('Well evidenced · 2 sources');
    expect(evidenceLabel('low', 1)).toBe('Thinly evidenced · 1 source');
    expect(evidenceLabel('unrated')).toBe('Not graded');
    expect(evidenceMeterLabel('medium', 4)).toBe('Partly evidenced, 4 sources');
  });

  it('uses the same phrases as the web', () => {
    const web = readFileSync(
      join(__dirname, '../../../web/src/lib/evidence/confidence-language.ts'),
      'utf8',
    );
    for (const tier of ['high', 'medium', 'low', 'unrated']) {
      expect(web).toContain(`'${evidenceLabel(tier)}'`);
    }
  });
});
