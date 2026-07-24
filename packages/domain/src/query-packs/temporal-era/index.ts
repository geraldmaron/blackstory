/**
 * Temporal-era query packs for Temporal Gap Discovery.
 *
 * Builds era-keyed discovery query packs for thin decades identified by
 * `discovery/temporal-gap-audit.ts`, using the shared query-pack contract
 * (`buildQueryPack`) so every era pack is semver'd, content-hashed, and
 * stampable onto discovery runs.
 *
 * Period record-language handling (dignity invariant):
 *  - Era terms live in the `historical` term class.
 *  - Terms like "Colored" and "Negro" are flagged `researchOnlyOffensive: true` —
 *    retained for internal archival queries (`toResearchQueryTerms`) because period
 *    records use that language, but NEVER emitted through public interfaces
 *    (`toPublicSafeTerms` strips them).
 *  - Every era pack also carries `modern`/`alias` counterparts so the public-safe
 *    projection is never empty.
 *
 * Gold fixture: `./fixtures/temporal-era-terms.v1.json` (decade → term classes),
 * validated against the in-code era table by `temporal-era.test.ts`.
 *
 * Research-only surface (ADR-009): this module produces query packs for private
 * research candidates only — no publish/projection writes, no I/O.
 */
import { buildQueryPack } from '../pack.js';
import { toPublicSafeTerms, toResearchQueryTerms, countRedactedTerms } from '../terms.js';
import type { PublicSafeTerm, QueryPack, QueryPackTheme, QueryTerm } from '../types.js';
import { QUERY_PACK_THEMES } from '../types.js';
import type { EntityKind } from '../../entity-kinds.js';

export const TEMPORAL_ERA_TERMS_SCHEMA_VERSION = 'temporal-era-terms.v1' as const;

/** Deterministic createdAt for reproducible content hashes (mirrors wikidata-place-first). */
export const TEMPORAL_ERA_PACK_CREATED_AT = '2026-07-24T00:00:00.000Z' as const;

export const TEMPORAL_ERA_PACK_SEMVER = '1.0.0' as const;

/** Decade start year as a 4-digit string ending in 0, e.g. '1890'. */
type DecadeKey = string;

const DECADE_KEY_PATTERN = /^\d{3}0$/;

function assertDecadeKey(decade: string): void {
  if (!DECADE_KEY_PATTERN.test(decade)) {
    throw new Error(`Invalid decade key "${decade}" — expected a decade start year like "1890"`);
  }
}

export type TemporalEra = {
  readonly id: string;
  readonly label: string;
  /** Inclusive decade range, e.g. 1880–1940 covers the 1880s through the 1940s. */
  readonly decadeStart: DecadeKey;
  readonly decadeEnd: DecadeKey;
  /** Period record-language terms (historical class; offensive ones flagged research-only). */
  readonly terms: readonly QueryTerm[];
};

/**
 * In-code era table — the source of truth. The JSON gold fixture
 * `fixtures/temporal-era-terms.v1.json` must stay in sync (asserted in tests).
 */
export const TEMPORAL_ERAS: readonly TemporalEra[] = [
  {
    id: 'era-reconstruction-freedmen',
    label: 'Emancipation & Reconstruction (1860s–1870s)',
    decadeStart: '1860',
    decadeEnd: '1870',
    terms: [
      { text: 'freedmen', termClass: 'historical' },
      { text: 'freedpeople', termClass: 'historical' },
      { text: "Freedmen's Bureau", termClass: 'historical' },
      { text: 'emancipation', termClass: 'historical' },
    ],
  },
  {
    id: 'era-colored-designation',
    label: '"Colored" record-language era (1880s–1940s)',
    decadeStart: '1880',
    decadeEnd: '1940',
    terms: [
      { text: 'Colored', termClass: 'historical', researchOnlyOffensive: true },
      { text: 'colored school', termClass: 'historical', researchOnlyOffensive: true },
      { text: 'colored cemetery', termClass: 'historical', researchOnlyOffensive: true },
    ],
  },
  {
    id: 'era-negro-designation',
    label: '"Negro" record-language era (1930s–1960s)',
    decadeStart: '1930',
    decadeEnd: '1960',
    terms: [
      { text: 'Negro', termClass: 'historical', researchOnlyOffensive: true },
      { text: 'Negro league', termClass: 'historical', researchOnlyOffensive: true },
      { text: 'Negro school', termClass: 'historical', researchOnlyOffensive: true },
    ],
  },
] as const;

/**
 * Modern/alias counterparts included in every era pack so the public-safe projection
 * (`toPublicSafeTerms`) is never empty even when all era terms are research-only.
 */
export const TEMPORAL_ERA_BASE_MODERN_TERMS: readonly QueryTerm[] = [
  { text: 'Black', termClass: 'modern' },
  { text: 'African American', termClass: 'modern' },
  { text: 'Black American', termClass: 'alias' },
] as const;

/** Decades with at least one registered era (ascending). */
export function listSupportedEraDecades(): readonly DecadeKey[] {
  const decades = new Set<string>();
  for (const era of TEMPORAL_ERAS) {
    for (let year = Number(era.decadeStart); year <= Number(era.decadeEnd); year += 10) {
      decades.add(String(year));
    }
  }
  return [...decades].sort((left, right) => left.localeCompare(right));
}

/** All eras whose inclusive decade range covers the given decade. */
export function erasForDecade(decade: DecadeKey): readonly TemporalEra[] {
  assertDecadeKey(decade);
  const year = Number(decade);
  return TEMPORAL_ERAS.filter(
    (era) => year >= Number(era.decadeStart) && year <= Number(era.decadeEnd),
  );
}

/**
 * Historical terms appropriate to a decade, merged across overlapping eras and
 * deduplicated by text+class (e.g. 1930s/1940s match both the "Colored" and "Negro" eras).
 */
export function eraTermsForDecade(decade: DecadeKey): readonly QueryTerm[] {
  const eras = erasForDecade(decade);
  const seen = new Set<string>();
  const merged: QueryTerm[] = [];
  for (const era of eras) {
    for (const term of era.terms) {
      const key = `${term.termClass}\u0000${term.text.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(term);
    }
  }
  return merged;
}

export type EraQueryPack = {
  readonly decade: DecadeKey;
  readonly theme: QueryPackTheme;
  /** Era ids that contributed historical terms. */
  readonly eraIds: readonly string[];
  /** Versioned, content-hashed pack built with the shared contract. */
  readonly pack: QueryPack;
  /** Internal query building — retains researchOnlyOffensive historical terms. */
  readonly researchTerms: readonly QueryTerm[];
  /** Public projection — research-only offensive terms stripped. Never bypass this. */
  readonly publicSafeTerms: readonly PublicSafeTerm[];
  readonly redactedTermCount: number;
};

export type BuildEraQueryPackOptions = {
  /** Entity kind the era campaign targets (default 'place' — place-first platform). */
  readonly entityKind?: EntityKind;
  readonly semver?: string;
  readonly createdAt?: string;
};

/**
 * Build an era-keyed query pack for one thin decade.
 *
 * Throws when the decade has no registered era terms — an unmapped decade must be an
 * explicit mapping decision (add an era to `TEMPORAL_ERAS` + the gold fixture), never a
 * silently empty historical pack.
 */
export function buildEraQueryPack(
  decade: DecadeKey,
  theme: QueryPackTheme,
  options: BuildEraQueryPackOptions = {},
): EraQueryPack {
  assertDecadeKey(decade);
  if (!(QUERY_PACK_THEMES as readonly string[]).includes(theme)) {
    throw new Error(`Unknown query pack theme: ${theme}`);
  }

  const eras = erasForDecade(decade);
  if (eras.length === 0) {
    throw new Error(
      `No temporal era terms registered for the ${decade}s — supported decades: ${listSupportedEraDecades().join(', ')}`,
    );
  }

  const historicalTerms = eraTermsForDecade(decade);
  const terms: readonly QueryTerm[] = [...historicalTerms, ...TEMPORAL_ERA_BASE_MODERN_TERMS];

  const pack = buildQueryPack({
    id: `qp-temporal-era-${decade}s-${theme.replace(/_/g, '-')}`,
    displayName: `Temporal gap era pack — ${decade}s (${theme})`,
    entityKind: options.entityKind ?? 'place',
    theme,
    semver: options.semver ?? TEMPORAL_ERA_PACK_SEMVER,
    createdAt: options.createdAt ?? TEMPORAL_ERA_PACK_CREATED_AT,
    notes:
      `Era-specific discovery pack for the ${decade}s, generated from thin-decade audit ` +
      `(temporal-gap.v1). Eras: ${eras.map((era) => era.id).join(', ')}. Historical record-language ` +
      'terms flagged researchOnlyOffensive are internal-query-only and never default public language.',
    terms,
  });

  return {
    decade,
    theme,
    eraIds: eras.map((era) => era.id),
    pack,
    researchTerms: toResearchQueryTerms(terms),
    publicSafeTerms: toPublicSafeTerms(terms),
    redactedTermCount: countRedactedTerms(terms),
  };
}

type RawTemporalEraTermsFixture = {
  readonly schemaVersion: string;
  readonly notes?: string;
  readonly eras: readonly TemporalEra[];
};

/** Parse + validate the decade→term-class gold fixture (temporal-era-terms.v1). */
export function parseTemporalEraTermsFixture(raw: unknown): readonly TemporalEra[] {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Temporal era terms fixture must be an object');
  }
  const fixture = raw as RawTemporalEraTermsFixture;
  if (fixture.schemaVersion !== TEMPORAL_ERA_TERMS_SCHEMA_VERSION) {
    throw new Error(`Unsupported temporal era fixture schema: ${String(fixture.schemaVersion)}`);
  }
  if (!Array.isArray(fixture.eras) || fixture.eras.length === 0) {
    throw new Error('Temporal era terms fixture requires a non-empty eras array');
  }
  for (const era of fixture.eras) {
    if (!era.id?.trim()) {
      throw new Error('Temporal era fixture entry missing id');
    }
    assertDecadeKey(era.decadeStart);
    assertDecadeKey(era.decadeEnd);
    if (Number(era.decadeStart) > Number(era.decadeEnd)) {
      throw new Error(`Temporal era ${era.id} has decadeStart after decadeEnd`);
    }
    if (!Array.isArray(era.terms) || era.terms.length === 0) {
      throw new Error(`Temporal era ${era.id} requires at least one term`);
    }
  }
  return fixture.eras;
}
