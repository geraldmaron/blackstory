import { datePrecisionCaption, formatEvidenceScoreLabel, formatFetchedAt, formatIsoDate, humanizeToken } from '../format';

describe('formatEvidenceScoreLabel — matches web wording exactly', () => {
  it('reads "Evidence score: <level> (<score> of 1.00)", never a probability', () => {
    expect(formatEvidenceScoreLabel(0.78, 'high')).toBe('Evidence score: high (0.78 of 1.00)');
    expect(formatEvidenceScoreLabel(0.5, 'medium')).toBe('Evidence score: medium (0.50 of 1.00)');
    expect(formatEvidenceScoreLabel(0.12, 'low')).toBe('Evidence score: low (0.12 of 1.00)');
  });

  it('never uses probability language', () => {
    for (const label of [formatEvidenceScoreLabel(0.9, 'high'), formatEvidenceScoreLabel(0.1, 'low')]) {
      expect(label).not.toMatch(/\bprobability\b/i);
      expect(label).not.toMatch(/\bchance(?:s)? (?:of|that)\b/i);
      expect(label).not.toMatch(/\blikely to be true\b/i);
    }
  });

  it('clamps an out-of-range or non-finite score rather than throwing/producing NaN', () => {
    expect(formatEvidenceScoreLabel(5, 'high')).toBe('Evidence score: high (1.00 of 1.00)');
    expect(formatEvidenceScoreLabel(-3, 'low')).toBe('Evidence score: low (0.00 of 1.00)');
    expect(formatEvidenceScoreLabel(Number.NaN, 'medium')).toBe('Evidence score: medium (0.00 of 1.00)');
  });
});

describe('humanizeToken', () => {
  it('title-cases snake_case tokens', () => {
    expect(humanizeToken('reputable_secondary')).toBe('Reputable Secondary');
    expect(humanizeToken('founded_by')).toBe('Founded By');
    expect(humanizeToken('')).toBe('');
  });
});

describe('formatIsoDate', () => {
  it('takes just the date part of an ISO timestamp', () => {
    expect(formatIsoDate('2026-06-01T00:00:00.000Z')).toBe('2026-06-01');
  });

  it('falls back to the raw string for a non-ISO value', () => {
    expect(formatIsoDate('undated')).toBe('undated');
    expect(formatIsoDate('')).toBe('');
  });
});

describe('datePrecisionCaption', () => {
  it('labels every precision level, mapping circa to "approximate"', () => {
    expect(datePrecisionCaption('day')).toBe('Date precision: day');
    expect(datePrecisionCaption('circa')).toBe('Date precision: approximate');
  });
});

describe('formatFetchedAt — deterministic, locale-independent', () => {
  it('formats a known epoch as UTC date + time', () => {
    // 2026-07-19T14:32:00.000Z
    const epoch = Date.UTC(2026, 6, 19, 14, 32, 0);
    expect(formatFetchedAt(epoch)).toBe('2026-07-19 14:32 UTC');
  });

  it('never throws on a non-finite input', () => {
    expect(formatFetchedAt(Number.NaN)).toBe('an unknown time');
  });
});
