# Temporal Gap Discovery

Research-discovery methodology that finds decades where the BlackStory catalog is thin
relative to its own average density, then launches era-specific discovery using
period-appropriate query terms. Contract layer only in this bead: pure audit functions +
era-keyed query packs. No persistence, no adapters, no publish surface.

**Invariants honored:** research workers cannot publish (ADR-009) — nothing here touches
public projections or release tables; all functions are pure (no I/O, so no fetch at all —
any future adapter work must go through `@repo/security` safe-fetch); offensive period
record-language is `researchOnlyOffensive` and never default public language; a thin
decade is a catalog-conditioned signal, never a claim of historical underrepresentation.

## Methodology

1. **Audit** — feed dated-entity counts per decade (e.g. from the catalog slice used for
   obscurity's reference corpus, optionally alongside `@repo/domain/demographics/population-decades`
   context) into `computeDecadeCoverage`. Each decade gets a temporal density factor:

   ```
   avg  = Σ count(d) / |decades|
   T(d) = clip01(1 − count(d) / avg)      T ∈ [0, 1], higher = thinner
   ```

   Every report is stamped `temporal-gap.v1` with a public-safe methodology disclaimer
   (`methodology_temporal_gap_heuristic_v1`), mirroring `obscurity.ts`.

2. **Rank** — `rankThinDecades(coverage, topN)` orders by highest `T`, ascending decade
   as the deterministic tie-break.

3. **Launch era packs** — for each thin decade, `buildEraQueryPack(decade, theme)` builds
   a versioned, content-hashed query pack (shared `buildQueryPack` contract, so it is
   registrable via `registerQueryPack` and stampable via `stampDiscoveryRun`) whose
   `historical`-class terms match the language of the period's records.

## Domain API

### `discovery/temporal-gap-audit.ts` (pure)

| Function | Purpose |
|----------|---------|
| `computeDecadeCoverage(entityCountByDecade)` | Per-decade density + `temporalDensityFactor T = 1 − count/avg`, sorted, stamped `temporal-gap.v1` |
| `rankThinDecades(coverage, topN)` | Thinnest decades first, deterministic tie-break |
| `isDecadeKeyValid` / `assertDecadeKeyValid` | Decade keys are 4-digit decade starts, 1790–2020 (compatible with `PopulationDecade`) |

Edge case: an all-zero slice reports `T = 0` everywhere with an explicit "no relative gap
signal" rationale — an empty catalog is not evidence that every decade is maximally thin.

### `query-packs/temporal-era/index.ts`

| Export | Purpose |
|--------|---------|
| `buildEraQueryPack(decade, theme, options?)` | Era pack for a thin decade: versioned pack + `researchTerms` (`toResearchQueryTerms`) + `publicSafeTerms` (`toPublicSafeTerms`) + `redactedTermCount` |
| `TEMPORAL_ERAS` / `erasForDecade` / `eraTermsForDecade` | Decade→era resolution; overlapping eras merge and dedupe |
| `listSupportedEraDecades()` | Continuous coverage 1860s–1960s; unmapped decades throw (never a silent empty pack) |
| `parseTemporalEraTermsFixture` | Validates the gold fixture against the in-code era table |

### Era → term-class mapping

Gold fixture: `packages/domain/src/query-packs/temporal-era/fixtures/temporal-era-terms.v1.json`
(schema `temporal-era-terms.v1`; test-asserted equal to `TEMPORAL_ERAS`).

| Era | Decades | `historical` terms | `researchOnlyOffensive` |
|-----|---------|--------------------|--------------------------|
| `era-reconstruction-freedmen` | 1860s–1870s | freedmen, freedpeople, Freedmen's Bureau, emancipation | no |
| `era-colored-designation` | 1880s–1940s | Colored, colored school, colored cemetery | **yes** |
| `era-negro-designation` | 1930s–1960s | Negro, Negro league, Negro school | **yes** |

Notes:
- The "Colored" era starts at 1880 (not 1890) so era coverage is continuous 1860s–1960s;
  the designation was in wide record use in the 1880s.
- "Colored" is flagged `researchOnlyOffensive` in addition to "Negro": both are retained
  for internal archival queries (period records use this language) but neither may be
  default public language — `toPublicSafeTerms` strips them, matching the dignity rule in
  `docs/research/query-packs.md` and the `black-history.v1.json` kernel profile's
  `researchOnlyOffensive` handling.
- Every era pack also carries `modern`/`alias` counterparts (`Black`, `African American`,
  `Black American`) so the public-safe projection is never empty.
- 1930s–1940s intentionally resolve to *both* the Colored and Negro eras (merged, deduped).

## PROPOSED: obscurity.v2 temporal density factor (NOT implemented)

`packages/domain/src/discovery/obscurity.ts` is **unchanged** by this bead
(`obscurity.v1`, guarded by a test). Proposed extension for a future `obscurity.v2`:

- New factor `temporal_density`: raw `T` from `computeDecadeCoverage` for the decade the
  candidate's evidence dates to (candidates without a resolvable decade get raw `0`,
  rationale "no dated evidence — no temporal factor", not a neutral boost).
- **Exact weight suggestion: `temporalDensity: 0.12`** (exported today as
  `PROPOSED_OBSCURITY_V2_TEMPORAL_WEIGHT` for review), funded by renormalizing the two
  largest positive v1 weights so positive mass stays 0.90:
  `catalogNovelty 0.30 → 0.24`, `nameRarity 0.22 → 0.16`; all other weights and both
  penalties unchanged. Score equation gains one term: `… + w_t·T …`.
- Requires: bumping `OBSCURITY_METHODOLOGY_VERSION` to `obscurity.v2`, a new factor id in
  `ObscurityFactorId`, a v2 disclaimer noting the temporal factor is catalog-conditioned,
  and side-by-side v1/v2 replay on a gold candidate set before adoption.

## Integration (for the parent agent — new files are self-contained; no barrels edited)

Append to `packages/domain/src/discovery/index.ts`:

```typescript
export {
  TEMPORAL_GAP_METHODOLOGY_VERSION,
  TEMPORAL_GAP_METHODOLOGY_DISCLAIMER,
  PROPOSED_OBSCURITY_V2_TEMPORAL_WEIGHT,
  isDecadeKeyValid,
  assertDecadeKeyValid,
  computeDecadeCoverage,
  rankThinDecades,
  type DecadeKey,
  type EntityCountByDecade,
  type DecadeCoverage,
  type DecadeCoverageReport,
} from './temporal-gap-audit.js';
```

Append to `packages/domain/src/query-packs/index.ts`:

```typescript
export * from './temporal-era/index.js';
```

Append to the `@repo/domain` `package.json` test file list:

```
src/discovery/temporal-gap-audit.test.ts src/query-packs/temporal-era/temporal-era.test.ts
```

Migration timestamp prefix `20260724000005` is reserved for this methodology; **no
migration is shipped in this bead** (in-memory/pure only — use the prefix if/when decade
coverage snapshots gain persistence).

## Acceptance mapping

1. Thin decades identified relative to catalog average → `computeDecadeCoverage` + `rankThinDecades` (`temporal-gap.v1`, disclaimer-stamped)
2. Era-specific discovery with period-appropriate language → `buildEraQueryPack` + `temporal-era-terms.v1.json`
3. Offensive record-language never public → `researchOnlyOffensive` + `toPublicSafeTerms` (test-asserted)
4. Obscurity extension proposed, not wired → `PROPOSED_OBSCURITY_V2_TEMPORAL_WEIGHT` + guard test that `obscurity.v1` weights are untouched

## Deferred (not this bead)

- Campaign runner (`runTemporalGapCampaign`) wiring era packs into the discovery pipeline
- Firestore persistence of decade coverage snapshots (prefix `20260724000005`)
- Black-population-relative density (juxtaposing `population-decades` counts against catalog density, with comparability-band caveats)
- obscurity.v2 implementation per the proposal above
