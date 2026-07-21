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

- database credentials and `bb_research.frontier_tasks` / `bb_research.runs` exist;
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
