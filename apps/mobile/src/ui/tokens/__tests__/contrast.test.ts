/**
 * Direct WCAG contrast assertions over the generated color tokens (not
 * hardcoded hex values — this test imports the same generated constants the
 * UI primitives consume, so it fails if a future regeneration ever produces
 * an inaccessible pair without going through brand-source.ts's own gate).
 */
import { contrastRatio } from '../../../../scripts/tokens/color-math';
import { confidenceColors, statusColors, themeColors } from '../generated/colors.generated';

const TEXT_MIN = 4.5;
const GRAPHIC_MIN = 3;

describe('generated color tokens meet WCAG AA', () => {
  (['light', 'dark'] as const).forEach((theme) => {
    const t = themeColors[theme];

    it(`${theme}: ink on canvas clears ${TEXT_MIN}:1`, () => {
      expect(contrastRatio(t.ink, t.canvas)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it(`${theme}: inkMuted on canvas clears ${TEXT_MIN}:1`, () => {
      expect(contrastRatio(t.inkMuted, t.canvas)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it(`${theme}: accent on canvas clears ${TEXT_MIN}:1`, () => {
      expect(contrastRatio(t.accent, t.canvas)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it(`${theme}: accentGraphic on canvas clears ${GRAPHIC_MIN}:1`, () => {
      expect(contrastRatio(t.accentGraphic, t.canvas)).toBeGreaterThanOrEqual(GRAPHIC_MIN);
    });

    it(`${theme}: focusRing on canvas clears ${GRAPHIC_MIN}:1`, () => {
      expect(contrastRatio(t.focusRing, t.canvas)).toBeGreaterThanOrEqual(GRAPHIC_MIN);
    });

    it(`${theme}: inverseInk on inverse clears ${TEXT_MIN}:1`, () => {
      expect(contrastRatio(t.inverseInk, t.inverse)).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    (['warning', 'dispute', 'error'] as const).forEach((status) => {
      it(`${theme}: status "${status}" fg/bg clears ${TEXT_MIN}:1`, () => {
        const pair = statusColors[theme][status];
        expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(TEXT_MIN);
      });
    });

    (['high', 'medium', 'low'] as const).forEach((level) => {
      it(`${theme}: confidence "${level}" fg/bg clears ${TEXT_MIN}:1`, () => {
        const pair = confidenceColors[theme][level];
        expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(TEXT_MIN);
      });
    });
  });
});
