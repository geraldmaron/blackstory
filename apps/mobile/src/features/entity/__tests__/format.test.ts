import {
  datePrecisionCaption,
  formatEvidenceScoreLabel,
  formatFetchedAt,
  formatIsoDate,
  formatSourceName,
  humanizeToken,
} from '../format';

describe('formatEvidenceScoreLabel', () => {
  it('does not display legacy numbers or invent a missing score', () => {
    expect(formatEvidenceScoreLabel(0.85, 'high')).toBe(
      formatEvidenceScoreLabel(undefined, 'high'),
    );
    expect(formatEvidenceScoreLabel(undefined, 'high')).not.toMatch(/\d/);
    expect(formatEvidenceScoreLabel(undefined, 'high')).toMatch(/^Evidence:/);
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

describe('formatSourceName — the source, not the connector that fetched it', () => {
  it('drops the connector suffix', () => {
    expect(formatSourceName('wikipedia_api')).toBe('Wikipedia');
    expect(formatSourceName('loc_web')).toBe('Loc');
    expect(formatSourceName('nara_v1')).toBe('Nara');
  });

  it('keeps a multi-word source readable', () => {
    expect(formatSourceName('national_archives_api')).toBe('National Archives');
  });

  it('leaves a source that is only a suffix alone rather than blanking it', () => {
    expect(formatSourceName('_api')).toBe('_api');
  });
});
