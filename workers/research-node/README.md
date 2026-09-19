# Research Node dispatcher

A headless adapter around `dispatchDiscoveryCampaign`. It reads explicit `DISCOVERY_*`
configuration and stages private discovery proposals. It installs no schedule and cannot publish.

The preferred interface is the operator CLI, run from the repository root:

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts discovery-dispatch \
  --job community-obscurity-discovery --mode fixture
```

`workers/research-node/src/main.ts` exposes the same operation to a process/container runtime.
`DISCOVERY_JOB_ID` is required. `DISCOVERY_MODE` is `fixture` by default or explicitly `live`.
Live execution requires `OPS_DATA_SOURCE=postgres`, a scoped server-only `DATABASE_URL`, source
configuration and preflight. `DISCOVERY_KILL_SWITCH=engaged` stops dispatch. Optional
`DISCOVERY_JOB_RUN_ID` identifies the run; `DISCOVERY_NOW_ISO` supplies a test clock.

Fixture success proves dispatch behavior, not a live harvest. The worker exits nonzero for a
kill-switch skip, failure or exception. Durable task/cost integration remains incomplete; see
[research framework](../../docs/research/README.md). No Corsair, systemd, launchd, or Cloud Scheduler
installation is part of this worker. Manual GitHub dispatch is available in
`.github/workflows/discovery-campaigns.yml`.
