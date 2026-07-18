# Security test checklist (BB-004 / BB-036)

> Manual and future-automated checks derived from [`../abuse-cases.md`](../abuse-cases.md).  
> BB-036 automation is mapped below and in [`asvs-checklist.md`](./asvs-checklist.md).
> Human and downstream checks remain release blockers where marked.

**Last updated:** 2026-07-17
**Corpus version:** see `docs/security/threat-corpus.json` → `version`

## Always-on (repo / scaffold)

| ID | Check | Status | Notes |
|----|-------|--------|-------|
| S-01 | Threat corpus JSON validates (19 threats, four control quadrants, residual risk) | automated | `pnpm --filter @repo/testing test` |
| S-02 | Every `T-xx` has matching `AC-xx` | automated | same package |
| S-03 | Every P0 threat lists ≥1 implementation bead | automated | same package |
| S-04 | Uploads disabled or gated until BB-031 | manual/scaffold | assert feature flag / route absent |
| S-05 | Tool-using LLM research disabled until BB-065 | manual/scaffold | assert no public LLM; no tool egress |

## AuthZ / surfaces (BB-021, BB-027, BB-028, BB-036)

| ID | Abuse | Check | Mode |
|----|-------|-------|------|
| A-04a | AC-04 | Public token cannot call `api-internal` publish | ci (`security-gates.test.ts`) |
| A-04b | AC-04 | Cannot read/modify another actor’s submission by ID | ci (`security-gates.test.ts`, BOLA) |
| A-03a | AC-03 | End-user Firebase token rejected on admin/publication | ci (`security-gates.test.ts` → Firebase auth gate) |
| A-16a | AC-16 | Research worker credentials cannot activate release | ci (`security-gates.test.ts`) |

## Abuse / quotas (BB-023–026, BB-029, BB-032)

| ID | Abuse | Check | Mode |
|----|-------|-------|------|
| A-01a | AC-01 | Edge/app returns 429 under flood; snapshots still readable | manual / BB-059 |
| A-02a | AC-02 | Cache-busting query params do not bypass CDN for static | ci |
| A-02b | AC-02 | Over-complex search rejected or times out | ci (`security-gates.test.ts` → query guardrails) |
| A-05a | AC-05 | Duplicate corrections do not raise confidence | ci |
| A-05b | AC-05 | Submission burst / oversized body hits quota | ci (`security-gates.test.ts`) |
| A-19a | AC-19 | Sequential entity enumeration throttled | ci / BB-059 |

## URL / file / model (BB-030, BB-031, BB-065)

| ID | Abuse | Check | Mode |
|----|-------|-------|------|
| A-08a | AC-08 | Request path never fetches submitted URL synchronously | ci |
| A-08b | AC-08 | Fetcher denies link-local, RFC1918, metadata, and loopback fixtures | ci (`security-gates.test.ts` → URL safety) |
| A-08c | AC-08 | Oversized response aborted | ci |
| A-09a | AC-09 | Malware/polyglot upload rejected or quarantined | deferred BB-031 |
| A-10a | AC-10 | Injection fixture cannot trigger publish or secret tool | deferred BB-065 |

## Privacy (BB-003, BB-015, BB-019)

| ID | Abuse | Check | Mode |
|----|-------|-------|------|
| A-15a | AC-15 | Living-person fixture never emits residential address on public DTO | ci |
| A-15b | AC-15 | Unknown living status ⇒ treat as living (constitution) | ci (exists via BB-003 fixtures) |
| A-15c | AC-15 | Logs/redaction strips protected addresses | ci / manual |

## Supply chain / secrets (BB-009, BB-010)

| ID | Abuse | Check | Mode |
|----|-------|-------|------|
| A-11a | AC-11 | Workflows use pinned Actions only | ci (`pnpm validate:governance`; `security.yml`) |
| A-11b | AC-11 | Deploy uses OIDC/WIF, not static keys | review (`infra/gcp/wif/`, `.github/workflows/deploy-production.yml`; no `credentials_json`) |
| A-12a | AC-12 | Secret scanning + push protection enabled | Gitleaks CI + human repo setting (`infra/github/security-gates/README.md`) |
| A-12b | AC-12 | Web client bundle scan finds no private keys | ci |

## Publication integrity (BB-019, BB-035, BB-061)

| ID | Abuse | Check | Mode |
|----|-------|-------|------|
| A-16b | AC-16 | Activate prior release restores public content | manual / BB-061 |
| A-17a | AC-17 | Staging credentials cannot mutate prod | ci / env isolation BB-005 |
| A-06a | AC-06 | Circular citation does not inflate confidence | ci BB-043 |
| A-07a | AC-07 | Quarantine item never appears on public projection without promotion | ci |

## Adapter drift (BB-037, BB-038, BB-047)

| ID | Abuse | Check | Mode |
|----|-------|-------|------|
| A-18a | AC-18 | Fixture with removed required fields fails closed | ci |
| A-18b | AC-18 | Adapter health alert on null-field spike | telemetry BB-034 |

## Sign-off

| Gate | Owner bead | Required before |
|------|------------|-----------------|
| Checklist items Mode=`ci` green in pipeline | BB-036 | BB-062 prod pipeline |
| Load/abuse/cost scenarios | BB-059 | BB-063 beta gate |
| Adversarial integrity | BB-060 | BB-063 |
| Rollback rehearsal | BB-061 | BB-063 |

When a check moves from scaffold → ci, update this table and link the test path (do not leave orphan checklist rows).

## BB-036 production security gates

| Gate | Automated evidence | Production rule |
|------|--------------------|-----------------|
| Code scanning | CodeQL security-extended SARIF | high/critical blocks |
| Dependency review | PR dependency review | high/critical blocks |
| Secrets | Gitleaks plus GitHub secret-scanning policy | any verified secret blocks |
| SBOM | SPDX JSON artifact | retained and attached to release |
| Vulnerabilities / IaC | Trivy filesystem, secret, misconfiguration, and image SARIF | high/critical blocks |
| API / abuse | `packages/testing/src/security-gates/security-gates.test.ts` | any failure blocks |
| DAST | protected manual staging ZAP baseline | production target forbidden |
| Release | Cosign verification + release-evidence contract | exact commit and digest required |

Suppressions are accepted only through
`infra/github/security-gates/suppressions.json`; reason, `team/handle` owner, and
future expiration are mandatory. Security artifacts are retained for at least 90 days
and must be attached to the release before production promotion.
