/**
 * Basic geographic extraction helpers for discovery candidates.
 * Heuristic text extraction only full geocoding deferred to /.
 */
import type { AdapterCandidateRecord } from '../adapters/types.js';
import type { GeographicHint } from './types.js';

const US_STATE_NAMES: Readonly<Record<string, string>> = {
  alabama: 'US-AL',
  alaska: 'US-AK',
  arizona: 'US-AZ',
  arkansas: 'US-AR',
  california: 'US-CA',
  colorado: 'US-CO',
  connecticut: 'US-CT',
  delaware: 'US-DE',
  florida: 'US-FL',
  georgia: 'US-GA',
  hawaii: 'US-HI',
  idaho: 'US-ID',
  illinois: 'US-IL',
  indiana: 'US-IN',
  iowa: 'US-IA',
  kansas: 'US-KS',
  kentucky: 'US-KY',
  louisiana: 'US-LA',
  maine: 'US-ME',
  maryland: 'US-MD',
  massachusetts: 'US-MA',
  michigan: 'US-MI',
  minnesota: 'US-MN',
  mississippi: 'US-MS',
  missouri: 'US-MO',
  montana: 'US-MT',
  nebraska: 'US-NE',
  nevada: 'US-NV',
  'new hampshire': 'US-NH',
  'new jersey': 'US-NJ',
  'new mexico': 'US-NM',
  'new york': 'US-NY',
  'north carolina': 'US-NC',
  'north dakota': 'US-ND',
  ohio: 'US-OH',
  oklahoma: 'US-OK',
  oregon: 'US-OR',
  pennsylvania: 'US-PA',
  'rhode island': 'US-RI',
  'south carolina': 'US-SC',
  'south dakota': 'US-SD',
  tennessee: 'US-TN',
  texas: 'US-TX',
  utah: 'US-UT',
  vermont: 'US-VT',
  virginia: 'US-VA',
  washington: 'US-WA',
  'west virginia': 'US-WV',
  wisconsin: 'US-WI',
  wyoming: 'US-WY',
  'district of columbia': 'US-DC',
};

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]);

const CITY_PATTERN = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/g;

function collectCandidateText(record: AdapterCandidateRecord): string {
  const parts: string[] = [];
  if (record.title) {
    parts.push(record.title);
  }
  if (record.payload) {
    for (const value of Object.values(record.payload)) {
      if (typeof value === 'string') {
        parts.push(value);
      }
    }
  }
  return parts.join(' ');
}

function extractStateHints(text: string): GeographicHint[] {
  const hints: GeographicHint[] = [];
  const lower = text.toLowerCase();

  for (const [name, code] of Object.entries(US_STATE_NAMES)) {
    const pattern = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (pattern.test(lower)) {
      hints.push({ text: code, kind: 'state', confidence: 0.85 });
    }
  }

  const codePattern = /\b([A-Z]{2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = codePattern.exec(text)) !== null) {
    const code = match[1]!;
    if (US_STATE_CODES.has(code)) {
      hints.push({ text: `US-${code}`, kind: 'state', confidence: 0.7 });
    }
  }

  return hints;
}

function extractCityHints(text: string): GeographicHint[] {
  const hints: GeographicHint[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(CITY_PATTERN.source, 'g');
  while ((match = pattern.exec(text)) !== null) {
    const city = match[1]!;
    const state = match[2]!;
    if (US_STATE_CODES.has(state)) {
      hints.push({
        text: `${city}, ${state}`,
        kind: 'city',
        confidence: 0.75,
      });
    }
  }
  return hints;
}

function dedupeHints(hints: readonly GeographicHint[]): GeographicHint[] {
  const seen = new Map<string, GeographicHint>();
  for (const hint of hints) {
    const key = `${hint.kind}:${hint.text.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || hint.confidence > existing.confidence) {
      seen.set(key, hint);
    }
  }
  return [...seen.values()];
}

/** Extract heuristic geographic hints from adapter candidate text and payload. */
export function extractGeographicHints(record: AdapterCandidateRecord): readonly GeographicHint[] {
  const text = collectCandidateText(record);
  if (!text.trim()) {
    return [];
  }
  return dedupeHints([...extractStateHints(text), ...extractCityHints(text)]);
}

/** Whether any extracted hint falls within campaign country boundaries. */
export function geographicHintWithinCountries(
  hints: readonly GeographicHint[],
  countries: readonly string[],
): boolean {
  if (countries.length === 0 || countries.includes('global')) {
    return true;
  }
  if (hints.length === 0) {
    return true;
  }
  const normalized = new Set(countries.map((c) => c.toUpperCase()));
  return hints.some((hint) => {
    if (hint.text.startsWith('US-')) {
      return normalized.has('US');
    }
    return normalized.has(hint.text.toUpperCase());
  });
}
