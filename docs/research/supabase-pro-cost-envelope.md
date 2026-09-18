# Supabase cost controls

Prices below were checked against official documentation on 2026-09-18. They are planning
inputs, not an invoice or evidence of the account's current plan, usage or project inventory.

## Billing model

Supabase bills per organization. A paid organization pays its plan fee plus compute for each
running project, minus one organization-level compute credit, plus usage and add-ons.

| Planning input | Published value |
|---|---|
| Pro plan | $25/month |
| Included compute credit | $10/month per organization |
| Micro compute | $0.01344/hour, approximately $10/month per project |
| One / two / three full-month Micro projects | Approximately $25 / $35 / $45 total before usage and add-ons |
| Database disk | 8 GB per project included on Pro |
| Pro egress quota | 250 GB uncached and 250 GB cached per organization; separate meters |
| Overage | $0.09/GB uncached; $0.03/GB cached |

Hour counts affect compute charges. Egress quotas do not multiply with the number of projects.
Pooler results contribute to Shared Pooler Egress. Supabase Storage CDN hits contribute to Cached
Egress. Moving SQL behind a server or placing files in Storage does not eliminate the bill.

## Execution policy

Use local isolated databases for migration rehearsals and deterministic evaluations. Do not
provision projects, paid branching, PITR, OCR campaigns or model jobs merely to validate code.
Choose recovery RPO/RTO from the actual preservation risk and prove a restore; a cheap plan does
not by itself establish that daily backups are sufficient.

Keep optional research subordinate to public serving through
`packages/security/src/resource-controls.ts`. Persist model budgets before dispatch, keep unknown
costs unknown and reconcile provider-reported usage. No research schedules should be active.

Before changing capacity, record the bottleneck: query plans and latency, disk/index sizes,
connection saturation, artifact bytes, cache hit rates and egress by service. Prefer bounded
queries, selective projections, versioned artifacts and measured caching before more compute.
A spend cap is not a universal cap on every possible add-on or compute charge.

## Traffic assumptions

For an illustrative workload, 1,000 users × 100 responses/day × 40 KB × 30 days is about
120 GB/month in decimal units, before headers and other services. Ten times that traffic is
about 1.2 TB. Measure actual wire bytes and cache misses before using either figure as a forecast.
An external cache can reduce Supabase origin requests; its own transfer and compute costs remain.

Prefer paginated bounded reads and release artifacts for bulk access. Avoid repeated full-corpus
queries, N+1 detail fetching, polling unchanged releases and embedding private evidence graphs in
public payloads. An open API also needs measured abuse controls and a source-rights policy.

## Sources

- [Organization billing and quotas](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Compute pricing and credits](https://supabase.com/docs/guides/platform/manage-your-usage/compute)
- [Egress services, quotas and pricing](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
- [Repository cost controls](../security/cost-resource-controls.md)
