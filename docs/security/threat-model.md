# BlackStory — Threat Model

> Expands the security and abuse assumptions in
> [`../decisions-carryover.md`](../decisions-carryover.md) into a threat corpus with preventive,
> detective, containment, and recovery controls. Machine-readable source:
> [`threat-corpus.json`](./threat-corpus.json).

**Status:** Accepted for planning. This corpus mixes implemented application contracts with design targets; optional GCP controls below are not evidence of a live deployment.
**Date:** 2026-07-16
**Architecture:** [`../architecture.md`](../architecture.md) and
[`service-surfaces.md`](./service-surfaces.md)
**Verification:** [`tests/checklist.md`](./tests/checklist.md) and
[`../../packages/testing/src/security-gates/security-gates.test.ts`](../../packages/testing/src/security-gates/security-gates.test.ts)

## Scope and method

- **Assets:** public corpus/releases, submission quarantine, research evidence, admin/publication paths, Supabase Postgres/Storage, provider spend (Vercel, Cloudflare, and Supabase), living-person privacy, CI/CD identities.
- **Trust:** public internet is hostile; browser clients are untrusted for authorization; anonymous users never write canonical history (`../decisions-carryover.md`, "Security and abuse assumptions").
- **Priority:** all listed threats are **P0** for product integrity, availability, or privacy. Features whose controls are deferred remain disabled until those controls are implemented and verified.
- **Degraded mode:** prefer killing mutations/search/research over wiping public snapshot reads.

## Threat inventory (19)

| ID | Threat |
|----|--------|
| [T-01](#t-01-volumetric-and-application-layer-denial-of-service) | Volumetric / app-layer DoS |
| [T-02](#t-02-cache-busting-and-expensive-search-attacks) | Cache-busting / expensive search |
| [T-03](#t-03-credential-stuffing-and-administrator-phishing) | Credential stuffing / admin phishing |
| [T-04](#t-04-broken-object-and-function-level-authorization-bolabfla) | BOLA / BFLA |
| [T-05](#t-05-spam-and-coordinated-correction-brigading) | Spam / correction brigading |
| [T-06](#t-06-historical-misinformation-and-source-laundering) | Misinformation / source laundering |
| [T-07](#t-07-data-poisoning-through-submissions-and-scraped-sources) | Data poisoning |
| [T-08](#t-08-malicious-urls-ssrf-redirects-dns-rebinding-oversized-responses) | Malicious URLs / SSRF / rebinding |
| [T-09](#t-09-malicious-file-uploads) | Malicious file uploads |
| [T-10](#t-10-prompt-injection-inside-researched-documents) | Prompt injection in documents |
| [T-11](#t-11-dependency-github-action-and-ci-supply-chain-compromise) | Supply-chain (deps / Actions / CI) |
| [T-12](#t-12-secret-leakage) | Secret leakage |
| [T-13](#t-13-database-exhaustion-and-connection-starvation) | DB exhaustion / connection starvation |
| [T-14](#t-14-cloud-bill-exhaustion) | Cloud bill exhaustion |
| [T-15](#t-15-privacy-attacks-and-attempts-to-expose-living-addresses) | Privacy / living addresses |
| [T-16](#t-16-defacement-and-unauthorized-publication) | Defacement / unauthorized publication |
| [T-17](#t-17-insider-mistakes-and-accidental-publication) | Insider mistakes / accidental publication |
| [T-18](#t-18-source-adapter-drift) | Source adapter drift |
| [T-19](#t-19-search-scraping-and-corpus-extraction) | Search scraping / corpus extraction |

Abuse cases and test mappings: [`abuse-cases.md`](./abuse-cases.md).
Manual/automated checklist: [`tests/checklist.md`](./tests/checklist.md).
Residual risk rollup: [Residual risk](#residual-risk).

---

## T-01 Volumetric and application-layer denial of service

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Cloudflare/Vercel edge behavior and application rate-limit policy where configured; CDN for immutable snapshots; optional Cloud Armor/ALB and Cloud Run controls are design-only; degraded snapshot mode without origin fan-out |
| **Detective** | QPS/error/latency anomalies; per-route 429/5xx; cost burn-rate alerts |
| **Containment** | Kill switches for search/submissions/geocode/exports before wiping corpus; optional Armor emergency blocks only if a future GCP edge is provisioned; throttle non-essential workers |
| **Recovery** | Restore from last good release; IR rehearsal; retune quotas |

**Abuse case:** AC-01

## T-02 Cache-busting and expensive search attacks

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Normalize/strip cache-busting params; client-header check on expensive reads; query complexity/timeouts/result caps; stricter search/geocode quotas |
| **Detective** | Cache hit-ratio and unique-query cardinality; per-client cost scoring; slow-query telemetry |
| **Containment** | Independent search/geocode kill switch; block abusive fingerprints; popular-query-only fallback |
| **Recovery** | Restore CDN rules; re-enable with tightened quotas after soak |

**Abuse case:** AC-02

## T-03 Credential stuffing and administrator phishing

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Shared /admin surface uses Supabase Auth plus a trusted app_metadata.app_role checked server-side; separate admin identity where feasible. MFA, recent reauthentication, and IAP are not currently enforced or proven. |
| **Detective** | Failed-login and anomalous-admin signals where available; Supabase auth audit and application audit are intended evidence, not a claim of complete live monitoring |
| **Containment** | Disable accounts; revoke sessions; publication kill switch; admin access lockdown through the deployed provider controls |
| **Recovery** | Rotate credentials; review the audit trail; rollback unauthorized releases |

**Abuse case:** AC-03

## T-04 Broken object and function-level authorization (BOLA/BFLA)

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Separate surfaces; server-side authZ every request; object-level checks; DB role allowlists |
| **Detective** | 401/403 probe patterns; cross-surface token misuse; CI security suite |
| **Containment** | Revoke tokens; deny internal ingress; quarantine objects |
| **Recovery** | Patch authZ + regression; restore last good release; re-issue least-privilege creds |

**Abuse case:** AC-04

## T-05 Spam and coordinated correction brigading

| Quadrant | Controls |
|----------|----------|
| **Preventive** | client-header check + rate limits; quarantine-first; volume ≠ truth; similarity clustering |
| **Detective** | Burst/entity-targeted dashboards; campaign heuristics; moderator backlog SLA |
| **Containment** | Submissions kill switch; auto-quarantine campaigns; elevate review on targeted entities |
| **Recovery** | Bulk reject; retract mistaken promotions; retune similarity/quotas |

**Abuse case:** AC-05

## T-06 Historical misinformation and source laundering

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Constitution gates; provenance/rights; lineage rejects circular inflation; promotion required |
| **Detective** | Dispute UI; gold corpus regressions; adversarial integrity |
| **Containment** | Hold/retract releases; disable adapters; promotion kill switch |
| **Recovery** | Corrected release + audit; update packs/adapters |

**Abuse case:** AC-06

## T-07 Data poisoning through submissions and scraped sources

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Quarantine + promotion controls; research cannot publish; corroboration; source trust tiers |
| **Detective** | Single-lineage confidence jumps; adapter/domain spikes; promotion denial rates |
| **Containment** | Freeze promotion; quarantine adapter output; revoke trust tier |
| **Recovery** | Demote/purge tainted claims; replay from good evidence; add poison pattern to gold corpus |

**Abuse case:** AC-07

## T-08 Malicious URLs, SSRF, redirects, DNS rebinding, oversized responses

| Quadrant | Controls |
|----------|----------|
| **Preventive** | No sync fetch in user requests; async fetcher with private-IP/DNS-rebind checks; redirect/size/time caps; egress isolation |
| **Detective** | Fetcher denial metrics; oversized/redirect-loop metrics; SSRF corpus tests |
| **Containment** | Disable fetch; quarantine URLs; domain deny lists |
| **Recovery** | Rotate reachable credentials; patch + regressions; re-scan quarantine |

**Abuse case:** AC-08

## T-09 Malicious file uploads

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Quarantine uploads; type sniff + size + malware scan; non-public bucket; sandboxed viewers |
| **Detective** | Scanner hits; upload volume anomalies; polyglot detections |
| **Containment** | Upload kill switch; isolate bucket; revoke signed URLs |
| **Recovery** | Delete/re-encrypt objects; rotate signing keys; re-enable after fixes |

**Abuse case:** AC-09
**Note:** Keep uploads disabled until the quarantine boundary and scanning controls are implemented and verified.

## T-10 Prompt injection inside researched documents

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Public render never calls LLM; LLMs cannot publish; tool/egress isolation; prefer deterministic extraction |
| **Detective** | Tool-call/egress anomalies; human review on model proposals; injection eval fixtures |
| **Containment** | LLM/research-mode kill switch; quarantine documents; revoke model keys if exfil |
| **Recovery** | Discard unpromoted model claims; retract sole-injection promotions; harden firewall |

**Abuse case:** AC-10
**Note:** Private research workers may make bounded source and model calls only through explicit
operator dispatch, and they cannot publish. No active research schedule or public/autonomous model
access is intended; either expansion requires verified isolation and review controls.

## T-11 Dependency, GitHub Action, and CI supply-chain compromise

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Pin/allowlist Actions; OIDC/WIF where the deployment provider supports and verifies it; Dependabot + lockfiles; CODEOWNERS. No current GCP WIF deployment is asserted. |
| **Detective** | Dependabot/secret scanning; unexpected workflow/Action changes; artifact provenance |
| **Containment** | Disable workflows; revoke OIDC; freeze deploys; rotate tokens |
| **Recovery** | Rebuild from known-good; redeploy prior release; tighten allowlists |

**Abuse case:** AC-11

## T-12 Secret leakage

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Secret Manager / 1Password; push protection; workload identity; log redaction |
| **Detective** | Secret scanning; anomalous credential use; client-bundle scanners |
| **Containment** | Revoke/rotate; disable SAs; feature kill switches |
| **Recovery** | Re-issue secrets; audit exposure window; history purge if needed |

**Abuse case:** AC-12

## T-13 Database exhaustion and connection starvation

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Pool caps + statement timeouts; read-only public role; search guardrails; reserved admin connections |
| **Detective** | Saturation/lock/CPU alerts; per-service pool dashboards; slow-query digests |
| **Containment** | Shed search load; kill runaway sessions; endpoint kill switches |
| **Recovery** | Restart pools; PITR if needed; query regressions; restore rehearsal |

**Abuse case:** AC-13

## T-14 Cloud bill exhaustion

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Budgets/hard quotas per env; bounded concurrency everywhere; dead-letter caps; separate research billing alerts |
| **Detective** | Burn-rate alerts; per-feature cost attribution; worker fan-out monitors |
| **Containment** | Kill research/LLM/geocode/exports; pause queues; emergency quota freeze |
| **Recovery** | Restore snapshot reads first; retune budgets; rerun cost-soak verification |

**Abuse case:** AC-14

## T-15 Privacy attacks and attempts to expose living addresses

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Unknown ⇒ living; never public residential fields; projection schema excludes protected data; log redaction |
| **Detective** | Public DTO absence tests; anomalous sensitive-field access; privacy review |
| **Containment** | Immediate release rollback; geocode/nearby kill switch; quarantine entity |
| **Recovery** | Purge caches/CDN/logs where feasible; privacy runbook; CI fixtures from leak pattern |

**Abuse case:** AC-15

## T-16 Defacement and unauthorized publication

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Immutable releases + explicit activation; publication authorization and approval separation; internal API requires service identity, while network isolation remains unproven; deploy gates |
| **Detective** | Audit every promotion; CDN hash drift; page on unexpected publication |
| **Containment** | Activate prior good release; publication kill switch; revoke publisher creds |
| **Recovery** | Forensic audit; corrected release + retraction; authZ regressions |

**Abuse case:** AC-16

## T-17 Insider mistakes and accidental publication

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Env isolation; confirmation/dry-run UX; staging-first; immutable rollback-as-switch |
| **Detective** | Pre-activation diffs; post-activation canaries; off-hours publication alerts |
| **Containment** | One-click prior release; disable further publications; page on-call |
| **Recovery** | Fix UX/process; rehearse rollback; add dual approval where mistakes recur |

**Abuse case:** AC-17

## T-18 Source adapter drift

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Versioned adapter contracts + query packs; fail-closed parse; rights checks |
| **Detective** | Parse-failure/null/volume cliffs; gold corpus diffs; sample checksums |
| **Containment** | Disable adapter; no auto-promote; alert CODEOWNERS |
| **Recovery** | Ship fixed version; quarantine drift-window captures; update fixtures |

**Abuse case:** AC-18

## T-19 Search scraping and corpus extraction

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Rate limits + client-header check; pagination caps; no unbounded public export; enumerate-resistant APIs |
| **Detective** | Sequential ID / high unique-entity rates; scraper clusters; atypical API vs web volume |
| **Containment** | Challenge/throttle; search/list kill switch; optional Armor ASN/IP blocks only if a future GCP edge is provisioned |
| **Recovery** | Retune throttling after an incident; pursue terms-of-service remedies; use watermarks only with product approval |

**Abuse case:** AC-19

---

## Residual risk

Every threat records residual risk in the corpus. Cross-cutting residuals:

1. **Public data is copyable.** Scraping cost can be raised; secrecy of released historical facts cannot be guaranteed (T-19).
2. **Perfect bot elimination is out of scope** (`../decisions-carryover.md`, "Security and abuse assumptions"). Aim for integrity and cost bounds (T-01, T-02, T-14).
3. **Human operators remain phishable and fallible.** Approval separation and fast rollback reduce blast radius only where they are deployed, exercised, and verified (T-03, T-16, T-17).
4. **General file uploads remain deferred** until their quarantine and scanning controls are verified. Private research workers already support bounded, operator-dispatched source and model calls that cannot publish; no active schedule or public/autonomous model access is intended (T-09, T-10).
5. **Implementation status varies by control.** Repository tests establish application contracts; live provider enforcement, alerting, identity separation, and operational exercises still require deployment evidence. Treat unverified controls as design targets, not evidence of production readiness.
6. **Third-party and historical sources may already expose living addresses**; BlackStory must not re-amplify them (T-15).

## Maintenance

- Amend the corpus and this document when a new threat class appears; update
  [`../decisions-carryover.md`](../decisions-carryover.md) if the security assumptions change.
- Keep automated checks aligned with
  [`tests/checklist.md`](./tests/checklist.md) and
  [`security-gates.test.ts`](../../packages/testing/src/security-gates/security-gates.test.ts).
- Do not claim Cloud Armor, client-header checks, IAP, MFA, or recent reauthentication exist until the relevant application or provider deployment is verified. The optional GCP files are design records only.
