# Architecture

BlackStory publishes evidence-backed Black history connected to people and places. The research
framework is intended to support other domains through explicit profiles and adapters. That
portability is partial: the kernel is generic, while several execution paths still depend on
BlackStory data and policy. [Research](./research/README.md) states the supported paths and gaps.

## Authority and entry points

Read this map, the [engineering contract](./decisions-carryover.md), and the contract for the
surface being changed. Then inspect the implementation and tests. These documents describe the
current system and desired constraints; neither prose nor code is exempt from challenge.

| Question | Authority |
|---|---|
| System shape and how to challenge it | This file |
| Cross-cutting engineering constraints | [Engineering contract](./decisions-carryover.md) |
| Research method, portability, execution status | [Research framework](./research/README.md) |
| Exact operator commands | [Research operations](./research/research-operations.md) |
| Stored schema and access controls | `supabase/migrations/`, reconciled with the running database |
| Research wire contracts | `packages/research-kernel/schemas/research-kernel.v1.schema.json` |
| Product policy | `packages/schemas/constitution/` |
| UI and brand | `docs/ui/README.md`, `docs/ui/PROTECTED-EXPERIENCES.md`, `brand/` |
| Work status and next actions | Beads; `bd ready`, `bd show <id>` |

Historical ADRs, PRDs, dated audits, and generated public docs are supporting evidence, never a
second authority. Do not recover an old decision merely because code cites its number. If the
current rule cannot be found, inspect the behavior, record the uncertainty, and resolve it here
or in the owning contract. Update existing authoritative prose instead of adding another memo.

## Runtime and module map

| Surface | Responsibility |
|---|---|
| `apps/web` | Next.js public web and staff-gated `/admin` console on Vercel |
| `apps/api-public` | Released public read/search/location API and mobile data boundary |
| `apps/api-submissions` | Quarantined contributions and corrections |
| `apps/api-internal` | Internal publication and control operations |
| `apps/mobile` | Expo native app, its own npm graph and verification path |
| `apps/docs` | Public documentation source, exported to GitHub Pages |
| `packages/research-kernel` | Generic schemas, profiles, validation, priority and stopping rules |
| `packages/research-harness` | Source adaptation, candidate signals, evidence-attached extraction |
| `packages/operator-cli` | Explicit research commands, safe retrieval, providers, persistence adapters |
| `packages/operator-mcp` | Read tools; not a complete research executor |
| `packages/domain-core`, `packages/domain` | Identity, claims, lineage, discovery and publication rules |
| `packages/data-access`, `packages/ops-data` | Postgres access and operator data workflows |
| `workers/*` | Explicit worker adapters for research, publication and security |
| `supabase/` | Database migrations, RLS, authorization functions and SQL tests |

Supabase Postgres and Storage hold product data and media. Cloudflare fronts the public web;
Vercel deploys the web application. Merging into the production branch can deploy through Vercel
Git integration independently of GitHub Actions. Check the release runbook before landing changes.
Repository configuration is not proof of live deployment, billing, or enabled schedules.

There is no research dependency on Corsair. No research schedule should be installed. Job
contracts and manual workflow dispatch remain so scheduling can be explicitly enabled in a
future authorized change. Remaining optional GCP service-control files describe potential deployments,
not permission to provision a parallel research platform.

## Data flow

Source or search lead → independently retrieved evidence → versioned capture and selector →
atomic claim or relationship proposal → identity/fitness/lineage/contradiction review →
canonical decision → approved release projection → public readers.

Keep the URL, holding institution, underlying work, capture, retrieval outcome, selector, and
claim assignment distinct. Research proposes; publication authorizes. An excerpt-match proves
where words came from, not whether the words establish the asserted fact. A graph path preserves
its edges and uncertainties; it never becomes a shortcut causal claim.

## Challenge procedure

Any agent can challenge a load-bearing choice without creating an ADR or PRD:

1. State the current claim and the user-visible outcome it serves. Identify the owning module,
   contract, tests, and any observed live evidence. Label fact, inference, and unknown separately.
2. State the strongest failure mode and best viable alternative. Include integrity, privacy,
   cost, operational burden, and the effect of missing or biased source material.
3. Define the smallest decisive experiment. Use realistic data and the actual interface. For a
   database or authorization change, include production-shaped migration and denial tests.
4. Record **accepted**, **accepted with controls**, **needs validation**, or **rejected**, with the
   evidence and the condition that would change the decision. Put work and dependencies in Beads.
5. Change the implementation, tests, and owning document together. Remove superseded paths and
   claims. Do not retain compatibility wrappers unless the user explicitly changes that goal.
6. Run the applicable project gates and observe the outcome. Report what remains unproven and
   the exact next check. Close work only when its stated acceptance criteria have been observed.

For routine reversible changes, this can be a short issue note plus the diff. The procedure is
for resolving uncertainty, not creating approval ceremony. Existing user authorization applies.
Code comments describe behavior, constraints, and reasons; investigation history belongs in Git.

## Validation

Run `fnm exec --using=22 -- ./scripts/ci-local.sh` for the real CI lanes. During implementation,
package tests provide faster feedback but do not replace those lanes. Database migrations need
SQL tests against the actual Supabase migration chain, not only the parked boundary-stub schema.
Mobile gates run from `apps/mobile`; root lint does not cover it. A user-visible behavior needs
an observed API, CLI, browser, or native result with realistic inputs.
