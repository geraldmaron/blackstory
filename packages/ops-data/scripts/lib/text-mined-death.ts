/**
 * Regex text-mining helpers for person death-year signals in summary / historicalContext prose.
 * Review lane only — never auto-writes bb_canonical.living_status.
 */
export type TextMinedDeathSignal = 'life_range' | 'death_lexicon' | 'lynching_verb';

export type TextMinedDeathHit = {
  readonly entityId: string;
  readonly deathYear: number;
  readonly birthYear?: number;
  readonly signal: TextMinedDeathSignal;
  readonly quote: string;
};

const DECEASED_LEXICON_RE =
  /\b(died|death|deceased|passed away|killed|assassinated|d\.\s*\d{4}|death date|hanged|executed|murdered|martyred|slain|posthumous(ly)?|buried at|laid to rest)\b/i;

/** Lynching verb forms only — bare "Lynch" surnames must not match. */
const LYNCHING_DECEASED_RE = /\b(was\s+lynched|lynched\s+(on|in|by)|lynching\s+of)\b/i;

const LIFE_RANGE_RE = /\((1[6-9]\d{2})\s*[–—-]\s*(1[6-9]\d{2}|20[0-2]\d)\)/;

const YEAR_RE = /\b(1[6-9]\d{2}|20[0-2]\d)\b/g;

const QUOTE_RADIUS = 80;

function quoteAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - QUOTE_RADIUS);
  const end = Math.min(text.length, index + length + QUOTE_RADIUS);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function isPlausibleDeathEndYear(
  year: number,
  asOfYear: number = new Date().getUTCFullYear(),
): boolean {
  return year <= asOfYear - 2;
}

export function mineLifeRangeDeathYear(
  text: string,
  asOfYear: number = new Date().getUTCFullYear(),
): { readonly birthYear: number; readonly deathYear: number; readonly quote: string } | null {
  const match = LIFE_RANGE_RE.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const birthYear = Number.parseInt(match[1], 10);
  const deathYear = Number.parseInt(match[2], 10);
  if (!Number.isFinite(birthYear) || !Number.isFinite(deathYear)) return null;
  if (!isPlausibleDeathEndYear(deathYear, asOfYear)) return null;
  return {
    birthYear,
    deathYear,
    quote: quoteAround(text, match.index, match[0].length),
  };
}

function nearestYear(text: string, anchorIndex: number, anchorLength: number): number | null {
  const windowStart = Math.max(0, anchorIndex - 48);
  const windowEnd = Math.min(text.length, anchorIndex + anchorLength + 48);
  const window = text.slice(windowStart, windowEnd);
  let best: { year: number; distance: number } | null = null;
  for (const match of window.matchAll(YEAR_RE)) {
    if (!match[1] || match.index === undefined) continue;
    const year = Number.parseInt(match[1], 10);
    if (!Number.isFinite(year)) continue;
    const absoluteIndex = windowStart + match.index;
    const distance = Math.abs(absoluteIndex - anchorIndex);
    if (!best || distance < best.distance) {
      best = { year, distance };
    }
  }
  return best?.year ?? null;
}

export function mineDeathWordNearYear(text: string): {
  readonly deathYear: number;
  readonly signal: 'death_lexicon' | 'lynching_verb';
  readonly quote: string;
} | null {
  const patterns: readonly {
    readonly re: RegExp;
    readonly signal: 'death_lexicon' | 'lynching_verb';
  }[] = [
    { re: LYNCHING_DECEASED_RE, signal: 'lynching_verb' },
    { re: DECEASED_LEXICON_RE, signal: 'death_lexicon' },
  ];

  let best: {
    readonly deathYear: number;
    readonly signal: 'death_lexicon' | 'lynching_verb';
    readonly quote: string;
    readonly distance: number;
  } | null = null;

  for (const { re, signal } of patterns) {
    const regex = new RegExp(re.source, `${re.flags.includes('g') ? re.flags : `${re.flags}g`}`);
    for (const match of text.matchAll(regex)) {
      if (match.index === undefined || !match[0]) continue;
      const deathYear = nearestYear(text, match.index, match[0].length);
      if (deathYear === null) continue;
      const candidate = {
        deathYear,
        signal,
        quote: quoteAround(text, match.index, match[0].length),
        distance: match.index,
      };
      if (!best || candidate.distance < best.distance) {
        best = candidate;
      }
    }
  }

  if (!best) return null;
  return {
    deathYear: best.deathYear,
    signal: best.signal,
    quote: best.quote,
  };
}

/** Returns false when prose only mentions a Lynch surname without lynching verb forms. */
export function isLynchSurnameFalsePositive(text: string): boolean {
  if (LYNCHING_DECEASED_RE.test(text)) return false;
  return /\b[A-Z][a-z]+ Lynch\b/.test(text) || /\bLynch,/.test(text);
}

export function mineTextForDeathYear(
  entityId: string,
  summary: string,
  historicalContext?: string,
  asOfYear: number = new Date().getUTCFullYear(),
): TextMinedDeathHit | null {
  const text = `${summary} ${historicalContext ?? ''}`.trim();
  if (!text) return null;
  if (isLynchSurnameFalsePositive(text)) return null;

  const lifeRange = mineLifeRangeDeathYear(text, asOfYear);
  if (lifeRange) {
    return {
      entityId,
      deathYear: lifeRange.deathYear,
      birthYear: lifeRange.birthYear,
      signal: 'life_range',
      quote: lifeRange.quote,
    };
  }

  const deathNearYear = mineDeathWordNearYear(text);
  if (deathNearYear) {
    return {
      entityId,
      deathYear: deathNearYear.deathYear,
      signal: deathNearYear.signal,
      quote: deathNearYear.quote,
    };
  }

  return null;
}
