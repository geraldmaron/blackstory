# Scheduling capability

The authoritative job registry is
[`packages/config/src/scheduled-jobs/roster.ts`](../../../packages/config/src/scheduled-jobs/roster.ts).
No research schedules should be active. Job definitions can be invoked explicitly through the
operator CLI or manual GitHub Actions dispatch.

There is no Cloud Scheduler deployment for this framework. A duplicate hand-maintained JSON
roster is not an execution contract. See the
[research framework](../../../docs/research/README.md) and
[explicit execution runbook](../../../docs/runbooks/discovery-campaign-automation.md).
