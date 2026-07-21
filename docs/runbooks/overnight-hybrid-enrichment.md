# Overnight research enrichment on Corsair

Corsair runs bounded discovery and enrichment against the canonical Supabase/Postgres ledger.
The job never publishes and does not contain a Firebase fallback.

## Runtime

| Item | Value |
|---|---|
| Host | `gerald-corsair-ai-workstation-300` / `100.119.72.84` |
| Repo | `~/Developer/Projects/blackstory` |
| Scheduler | systemd user timer |
| Search | local SearXNG at `http://127.0.0.1:8888` |
| Local model | Ollama `qwen3:8b` |
| Ledger | Supabase/Postgres through a server-only database URL |

The checkout on Corsair must track `origin/main` over HTTPS (no GitHub SSH key on the host). If
`.git` is missing, shallow-clone to a temp directory, move `.git` into the existing tree, run
`git fetch` and `git reset --hard origin/main`, and restore `.cache` from a backup; leave
`~/.config/blackstory/*.env` untouched.

Entry points:

- `scripts/run-overnight-hybrid-enrichment.sh`
- `scripts/run-scheduled-searxng-discovery.sh`
- `scripts/systemd/blackstory-overnight-enrichment.service`

## Required private environment

Both files must be mode `0600`:

| File | Values |
|---|---|
| `~/.config/blackstory/enrichment.env` | `OPENROUTER_API_KEY`, optional privacy pepper |
| `~/.config/blackstory/postgres.env` | `DATABASE_URL`, profile/schema versions, `OPS_DATA_SOURCE=postgres` |

The scheduled unit no longer reads `discovery.env`. Retire any former ADC/project file rather than
leaving it on the live service path.

## Mandatory preflight

Every entry point runs this before issuing a query:

```bash
node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts preflight
```

It fails closed unless all of these pass:

- `OPS_DATA_SOURCE=postgres`, database credentials, and `bb_research.frontier_tasks` / `bb_research.runs` exist;
- profile id `black-history`, profile version `1.0.0`, and schema version `1.0.0` match;
- SearXNG and Ollama are reachable and `qwen3:8b` is installed;
- the configured minimum disk space is available;
- OpenRouter credentials exist when the provider is `openrouter` or `hybrid`.

Do not enable the timer after a failed preflight. Schema changes to hosted Supabase remain an
explicitly approved migration operation.

## Install and verify

```bash
scp -o BatchMode=yes scripts/systemd/blackstory-overnight-enrichment.service \
  gerald@100.119.72.84:~/.config/systemd/user/

ssh -o BatchMode=yes gerald@100.119.72.84 \
  'systemctl --user daemon-reload && systemctl --user reset-failed blackstory-overnight-enrichment.service'
```

After preflight succeeds:

```bash
ssh -o BatchMode=yes gerald@100.119.72.84 \
  'systemctl --user enable --now blackstory-overnight-enrichment.timer'
```

## Guardrails

- SearXNG: at most 12 queries and 50 survivors per run.
- Wikimedia: capped rounds, URL count, and concurrency.
- Enrichment: prepare-only unless both commit controls are deliberately enabled.
- Public publication flags, gated crawling, Playwright, and unrestricted scraping are refused.
- OpenRouter uses explicit model ids; the nondeterministic free router is prohibited.
- Candidate files live under `.cache/discovery-candidates`, not a database-package fixture path.

## Monitor

```bash
ssh -o BatchMode=yes gerald@100.119.72.84 \
  'systemctl --user status blackstory-overnight-enrichment.service --no-pager'
ssh -o BatchMode=yes gerald@100.119.72.84 \
  'journalctl --user -u blackstory-overnight-enrichment.service -n 200 --no-pager'
```

Artifacts are written to `.cache/overnight-enrichment/`. The full result is written synchronously
to disk; only compact progress/summary records go to the journal.

Stop immediately with:

```bash
ssh -o BatchMode=yes gerald@100.119.72.84 \
  'systemctl --user stop blackstory-overnight-enrichment.timer blackstory-overnight-enrichment.service'
```

## Ledger parity cycles (human observation)

After each production-equivalent overnight window, compare Postgres ledger rows with journal output
and `.cache/overnight-enrichment/` artifacts. Firestore is not the system of record for scheduled
research — bounded export/reconciliation utilities only.

| Cycle | Status | Observed at | Observer | Notes |
|---|---|---|---|---|
| cycle-1 | **PENDING** | — | — | First overnight run after timer enable (2026-07-21) |
| cycle-2 | **PENDING** | — | — | Second consecutive overnight run |

Mark a cycle **PASSED** only when all probes below agree within the window (`:window_start` =
service `Started` timestamp from journal, or the prior timer fire if overlapping).

### What to compare

1. **Run rows** — `bb_research.runs`: `mode`, `status`, `terminal_reason`, `started_at`,
   `completed_at` vs systemd exit code and enrichment summary JSON.
2. **Costs and counters** — `cost_usd`, `query_count`, `candidate_url_count`, `capture_count` vs
   OpenRouter/Ollama usage in enrichment logs.
3. **Heartbeats** — `runs.heartbeat_at` during long enrichment; `frontier_tasks` terminal status
   without orphaned `leased_until` after service exit.
4. **Artifact counts** — `bb_research.cases`, `artifacts`, `agent_activities`, `model_invocations`
   vs prepare-only JSON artifacts (and quarantine intake when commit break-glass is used).
5. **Intake/outbox (commit only)** — `bb_submissions.intake_items`, `bb_audit.events`,
   `bb_ops.outbox_messages` when `COMMIT_ENRICHMENT=1` + `ALLOW_ENRICHMENT_COMMIT=1`.

### SQL probes

Replace `:window_start` with the ISO timestamp for the window under review.

```sql
-- run rows
SELECT id, mode, status, terminal_reason, started_at, completed_at, heartbeat_at
FROM bb_research.runs
WHERE started_at >= :window_start
ORDER BY started_at;

-- costs and counters
SELECT id, cost_usd, query_count, candidate_url_count, capture_count, relationship_hop_count
FROM bb_research.runs
WHERE started_at >= :window_start
ORDER BY started_at;

-- heartbeats and frontier terminal state
SELECT r.id AS run_id, r.heartbeat_at, r.status AS run_status,
       ft.id AS task_id, ft.status AS task_status, ft.leased_until, ft.completed_at
FROM bb_research.runs r
LEFT JOIN bb_research.frontier_tasks ft ON ft.case_id = r.case_id
WHERE r.started_at >= :window_start
ORDER BY r.started_at, ft.created_at;

-- artifact counts
SELECT
  (SELECT count(*) FROM bb_research.cases c WHERE c.created_at >= :window_start) AS cases,
  (SELECT count(*) FROM bb_research.artifacts a WHERE a.created_at >= :window_start) AS artifacts,
  (SELECT count(*) FROM bb_research.agent_activities aa
     JOIN bb_research.runs r ON r.id = aa.run_id
    WHERE r.started_at >= :window_start) AS activities,
  (SELECT count(*) FROM bb_research.model_invocations mi
     JOIN bb_research.agent_activities aa ON aa.id = mi.activity_id
     JOIN bb_research.runs r ON r.id = aa.run_id
    WHERE r.started_at >= :window_start) AS model_invocations;
```

Programmatic checklist helper (same content):

```bash
node --conditions development --import tsx -e \
  "import { parityChecklistMarkdown } from './packages/operator-cli/src/ledger-parity.ts'; console.log(parityChecklistMarkdown());"
```

**Close criteria for `repo-atya`:** both cycles marked PASSED with signed observer notes; no
Firestore dispatch docs on live Corsair paths; preflight remains green with `OPS_DATA_SOURCE=postgres`.
