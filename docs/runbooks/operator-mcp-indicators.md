# Runbook: Operator MCP — Phase 1 indicators

**Scope:** read-only operator/research MCP tools over `bb_reference.statistical_*` and `entity_context_bindings`. This is **not** the public heritage MCP ([public-mcp-unlock-criteria.md](../research/public-mcp-unlock-criteria.md)).

**Package:** `@repo/operator-mcp` (`packages/operator-mcp`)

**Contract:** [operator-mcp-indicator-contracts.md](../research/operator-mcp-indicator-contracts.md)

---

## Prerequisites

1. Postgres with Phase 1 indicator tables migrated (`supabase/migrations/20260721220000_statistical_series_observations.sql`).
2. Optional fixture load for local dev:

   ```bash
   DATABASE_URL="$DATABASE_URL" \
     node --conditions development --import tsx \
     packages/firebase/scripts/ingest-phase1-indicators.ts
   ```

3. **Operator database URL** — use a research/operator role connection string (`DATABASE_URL` or `APP_DATABASE_URL`). Do **not** use Supabase service-role or any `NEXT_PUBLIC_*` database env var with this MCP.

---

## Run the MCP server (stdio)

From repo root after `pnpm install`:

```bash
export DATABASE_URL="postgresql://…"   # research/operator role
pnpm --filter @repo/operator-mcp start
```

Or via the built bin after `pnpm --filter @repo/operator-mcp build`:

```bash
node packages/operator-mcp/dist/bin.js
```

The server speaks MCP over stdin/stdout. Log diagnostics to stderr only.

---

## Cursor / Claude Desktop MCP config

Add to your MCP settings (example — adjust paths):

```json
{
  "mcpServers": {
    "blackstory-operator-indicators": {
      "command": "node",
      "args": [
        "--conditions",
        "development",
        "--import",
        "tsx",
        "/absolute/path/to/blackstory-mobile/packages/operator-mcp/src/bin.ts"
      ],
      "env": {
        "DATABASE_URL": "postgresql://research-role:…@…/postgres"
      }
    }
  }
}
```

---

## Tools

| Tool | Purpose |
|------|---------|
| `lookup_series` | List/fetch metric definitions (`metricId`, `theme`, `geographyType` filters) |
| `get_observations` | As-reported observations for a `metricId` (+ optional jurisdiction/period); requires provenance |
| `get_entity_context` | Curated entity↔indicator bindings + `juxtapositionDisclaimer` |
| `get_law_timeline` | **Stub** — returns empty timeline until ADR-026 heritage reads are wired |

Every observation payload includes provenance (`source`, `sourceUrl`, `retrievedAt`, `contentHash`). Juxtaposition responses always include `juxtapositionDisclaimer`.

---

## Tests

```bash
pnpm --filter @repo/operator-mcp test
pnpm --filter @repo/operator-mcp typecheck
```

Tests use an in-memory mock DB reader — no live Postgres required.

---

## Error codes

| Code | When |
|------|------|
| `unknown_metric` | `metricId` not in DB or Phase 1 catalog |
| `unknown_jurisdiction` | `jurisdictionId` missing from `bb_reference.jurisdictions` |
| `forbidden_causal` | Client asks for automated causal impact |
| `invalid_input` | Missing required fields or bad limits |

See the contract doc for `boundary_mismatch` (reserved for crosswalk violations in later phases).
