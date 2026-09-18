# Explicit discovery execution

Research job definitions are schedulable, but no research schedules are enabled by this repository.
Use a manual CLI process or `workflow_dispatch` in `.github/workflows/discovery-campaigns.yml`.
No personal workstation is a dependency. Do not install timers, cron jobs, or background agents.

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-dispatch \
  --job discovery-campaign-web-search --mode fixture
```

Fixture mode checks plumbing with labeled test data. A live run requires explicit provider and
Postgres configuration, source/storage authorization, a bounded campaign, and the existing
preflight/kill-switch checks. It can stage private records and must not publish.

`packages/config/src/scheduled-jobs/roster.ts` defines budgets, timeouts, cadence metadata and
worker ownership. Retain that capability without deploying its cadence. Curated optional search
queries are in `packages/config/src/scheduled-jobs/data/web-search-queries.json`; the manual
caller selects its queries explicitly.

See [research framework](../research/README.md) for the method, [operations](../research/research-operations.md)
for verb details, and [audit](../research/framework-audit.md) for execution and ledger gaps.
