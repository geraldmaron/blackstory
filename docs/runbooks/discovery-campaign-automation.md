# Discovery campaign automation

Discovery is scheduled on Corsair and records private proposal, audit, outbox, and research-case
state in Supabase/Postgres. It never publishes. The former scheduled Cloud Functions package is
retired; `functions/README.md` is its tombstone.

## Control plane

1. `@repo/config` validates the bounded job roster and dispatch input.
2. `operator-cli preflight` validates the ledger, policy versions, dependencies, disk, and models.
3. `bb_ops.kill_switches` is the canonical kill-switch table.
4. Operator proposal commits write state, audit, outbox, and idempotency rows transactionally.
5. systemd records terminal process status while the research ledger records durable run state.

## Live SearXNG

```bash
SEARXNG_BASE_URL=http://127.0.0.1:8888 \
DISCOVERY_STORAGE_TERMS_CONFIRMED=true \
DISCOVERY_KILL_SWITCH=disengaged \
./scripts/run-scheduled-searxng-discovery.sh
```

The script rotates through
`packages/config/src/scheduled-jobs/data/corsair-web-search-queries.json`. A single query may be
selected with `DISCOVERY_SEARXNG_QUERY`. Results are leads until their underlying evidence is
captured and reviewed.

## Where committed survivors go

| Artifact | Postgres destination |
|---|---|
| Quarantined proposal | `bb_submissions.intake_items` |
| Draft research case | `bb_research.cases` plus normalized history/checklist rows |
| Audit event | `bb_audit.events` |
| Delivery work | `bb_ops.outbox_messages` |
| Replay protection | `bb_ops.idempotency_keys` |

`COMMIT_SURVIVORS=1` creates private review work only. It cannot activate a release.

## Required environment

```text
OPS_DATA_SOURCE=postgres
RESEARCH_PROFILE_ID=black-history
RESEARCH_PROFILE_VERSION=1.0.0
RESEARCH_SCHEMA_VERSION=1.0.0
DATABASE_URL=<scoped server-only URL>
DISCOVERY_STORAGE_TERMS_CONFIRMED=true
```

OpenRouter and Ollama variables are documented in
[`overnight-hybrid-enrichment.md`](./overnight-hybrid-enrichment.md).

## Safety limits

- Hard query, survivor, round, capture, concurrency, time, and spend caps.
- `DISCOVERY_KILL_SWITCH=engaged` prevents dispatch.
- Missing database credentials or ledger tables prevent all live work.
- Missing kill-switch state fails closed.
- HTML crawl, gated-source scrape, browser automation, and public publish flags are refused.
- A commit is proposal-only; independent approval and release activation remain separate.

## Operations

```bash
systemctl --user start blackstory-overnight-enrichment.service
systemctl --user status blackstory-overnight-enrichment.service --no-pager
journalctl --user -u blackstory-overnight-enrichment.service -n 200 --no-pager
```

Keep the timer stopped after any preflight failure. Do not restore a legacy backend selector to
work around an unavailable Postgres ledger.
