<!--
  Operator MCP tool contracts for indicator / entity-context reads.
  Distinct from public heritage MCP unlock criteria — research/operator only.
-->

# Operator MCP — indicator and entity-context contracts

**Purpose:** Define read-only tool shapes for an **operator / research** MCP that wraps PostgREST or internal readers over `bb_reference` statistical tables and published entities. This is **not** the public Black-history MCP ([public-mcp-unlock-criteria.md](public-mcp-unlock-criteria.md)).

**Depends on:** Phase 1 indicator catalog + `statistical_series` / `statistical_observations` tables; ADR-026 published views for entity reads; [juxtaposition-not-causation.md](../methodology/juxtaposition-not-causation.md).

**Hard rules:** No research-write paths. No service-role credentials shared with a public MCP. Every numeric field returns provenance. Never invent causal impact language.

---

## Tools

### `lookup_series`

List or fetch metric definitions.

**Input**

```json
{
  "metricId": "acs-median-hh-income-black-county",
  "theme": "wealth",
  "geographyType": "county"
}
```

All fields optional; empty input returns Phase 1 catalog summaries.

**Output**

```json
{
  "series": [
    {
      "metricId": "acs-median-hh-income-black-county",
      "metricDefinition": "…",
      "universe": "households",
      "unit": "USD",
      "sourceDataset": "ACS 5-Year",
      "sourceTable": "B19013B",
      "sourceVariable": "B19013B_001E",
      "geographyType": "county",
      "estimateType": "median",
      "periodType": "5-year-estimate",
      "externalDataSourceId": "acs-via-census-api"
    }
  ]
}
```

---

### `get_observations`

Fetch as-reported observations for a series.

**Input**

```json
{
  "metricId": "imprisonment-rate-black-state",
  "jurisdictionId": "state:24",
  "referencePeriod": "2022",
  "limit": 50
}
```

**Output**

```json
{
  "observations": [
    {
      "id": "obs:…",
      "metricId": "imprisonment-rate-black-state",
      "jurisdictionId": "state:24",
      "boundaryVersion": "state-2020",
      "referencePeriod": "2022",
      "datasetVintage": "BJS NPS 2022",
      "estimate": 912,
      "marginOfError": null,
      "status": "observed",
      "provenance": {
        "source": "bjs-national-prisoner-statistics",
        "sourceUrl": "https://bjs.ojp.gov/…",
        "retrievedAt": "2026-07-21T00:00:00.000Z",
        "contentHash": "…"
      }
    }
  ],
  "disclaimer": "Values are transcribed published statistics, not BlackStory judgments."
}
```

Reject requests that omit `metricId`. Cap `limit` (default 100, max 500).

---

### `get_entity_context`

Juxtapose an entity with curated indicator bindings.

**Input**

```json
{
  "entityId": "law:war-on-drugs-…",
  "purpose": "mcp",
  "referencePeriod": "2020"
}
```

**Output**

```json
{
  "entityId": "law:war-on-drugs-…",
  "bindings": [
    {
      "metricId": "imprisonment-rate-black-state",
      "purpose": "mcp",
      "jurisdictionId": "state:24",
      "notes": "State imprisonment context for the era — not a causal claim.",
      "observation": { }
    }
  ],
  "juxtapositionDisclaimer": "Context indicators are published measurements from named custodians. Showing them with a law or place does not establish that the law caused the indicator values. Causal statements require separately evidenced claims."
}
```

If no bindings exist, return empty `bindings` and the same disclaimer — do not invent metrics.

---

### `get_law_timeline`

Heritage-lane helper (wraps published entity + relationships).

**Input:** `{ "entityId": "…" }` or `{ "topicId": "criminal-justice", "stateFips": "24" }`

**Output:** Law/case entities with enactment/repeal claims, citation hrefs, confidence labels — **no** auto-attached impact percentages.

---

## Error model

| Code | When |
|------|------|
| `unknown_metric` | metricId not in catalog / series table |
| `unknown_jurisdiction` | jurisdiction id missing from `bb_reference.jurisdictions` |
| `boundary_mismatch` | Requested join crosses `boundary_version` without crosswalk |
| `forbidden_causal` | Client asks for “impact of X on Y” as a computed effect — return methodology pointer instead of a number |

## Implementation notes

- Prefer PostgREST views over `bb_reference.statistical_*` with RLS (service/research roles) or a thin Next.js route used only by operator credentials.
- Reuse `assertPublishedStatisticProvenance` before any public projection of observations.
- Phase 1 fixture path: load from `packages/firebase/fixtures/reference-indicators/` via `ingest-phase1-indicators.ts` until live ACS/BJS loaders land.

### Shipped implementation (Phase 1)

| Surface | Location |
|---------|----------|
| MCP stdio server | `packages/operator-mcp` (`@repo/operator-mcp`) |
| Runbook | [docs/runbooks/operator-mcp-indicators.md](../runbooks/operator-mcp-indicators.md) |
| Tests | `packages/operator-mcp/src/tools/*.test.ts` (mock DB reader) |

**Run:** `DATABASE_URL=… pnpm --filter @repo/operator-mcp start`

Credentials: research/operator Postgres role via `DATABASE_URL` — never service-role in this MCP path.
