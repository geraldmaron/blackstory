# Blap — Threat Model (BB-004)

> Expands [ADR-010](../adr/ADR-010-security-and-abuse-assumptions.md) into a full threat corpus with preventive, detective, containment, and recovery controls. Machine-readable source: [`threat-corpus.json`](./threat-corpus.json).

**Status:** Accepted for planning (controls are design targets; most are not yet implemented).  
**Date:** 2026-07-16  
**Depends on:** BB-001, BB-003, ADR-010  
**Implements toward:** Tranche 3 (BB-021–036), BB-030, BB-032–036, deferred BB-031/064/065

## Scope and method

- **Assets:** public corpus/releases, submission quarantine, research evidence, admin/publication paths, Cloud SQL, GCP spend, living-person privacy, CI/CD identities.
- **Trust:** public internet is hostile; browser clients untrusted for authZ; anonymous users never write canonical history (ADR-010).
- **Priority:** all BB-004-listed threats are **P0** for product integrity/availability/privacy. Deferred beads (e.g. BB-031, BB-064/065) still map as controls; enabling those features early without controls is rejected.
- **Degraded mode:** prefer killing mutations/search/research over wiping public snapshot reads.

## Threat inventory (19)

| ID | Threat | Primary beads |
|----|--------|---------------|
| [T-01](#t-01-volumetric-and-application-layer-denial-of-service) | Volumetric / app-layer DoS | BB-023, BB-025, BB-033–035, BB-059 |
| [T-02](#t-02-cache-busting-and-expensive-search-attacks) | Cache-busting / expensive search | BB-024–026, BB-033, BB-049, BB-059 |
| [T-03](#t-03-credential-stuffing-and-administrator-phishing) | Credential stuffing / admin phishing | BB-021, BB-027, BB-034–035 |
| [T-04](#t-04-broken-object-and-function-level-authorization-bolabfla) | BOLA / BFLA | BB-013, BB-021, BB-027–028, BB-036 |
| [T-05](#t-05-spam-and-coordinated-correction-brigading) | Spam / correction brigading | BB-024–025, BB-029, BB-032, BB-055 |
| [T-06](#t-06-historical-misinformation-and-source-laundering) | Misinformation / source laundering | BB-003, BB-016–017, BB-032, BB-043, BB-060 |
| [T-07](#t-07-data-poisoning-through-submissions-and-scraped-sources) | Data poisoning | BB-029, BB-032, BB-037–040, BB-060 |
| [T-08](#t-08-malicious-urls-ssrf-redirects-dns-rebinding-oversized-responses) | Malicious URLs / SSRF / rebinding | BB-030, BB-036, BB-065 |
| [T-09](#t-09-malicious-file-uploads) | Malicious file uploads | BB-029, BB-031, BB-036 |
| [T-10](#t-10-prompt-injection-inside-researched-documents) | Prompt injection in documents | BB-064, BB-065 (deferred) |
| [T-11](#t-11-dependency-github-action-and-ci-supply-chain-compromise) | Supply-chain (deps / Actions / CI) | BB-008–010, BB-036, BB-062 |
| [T-12](#t-12-secret-leakage) | Secret leakage | BB-005, BB-009–011, BB-027 |
| [T-13](#t-13-database-exhaustion-and-connection-starvation) | DB exhaustion / connection starvation | BB-012–013, BB-025–026, BB-033 |
| [T-14](#t-14-cloud-bill-exhaustion) | Cloud bill exhaustion | BB-005, BB-033–035, BB-059 |
| [T-15](#t-15-privacy-attacks-and-attempts-to-expose-living-addresses) | Privacy / living addresses | BB-003, BB-015, BB-019, BB-036, BB-057 |
| [T-16](#t-16-defacement-and-unauthorized-publication) | Defacement / unauthorized publication | BB-018–019, BB-027, BB-035, BB-044 |
| [T-17](#t-17-insider-mistakes-and-accidental-publication) | Insider mistakes / accidental publication | BB-005, BB-019, BB-035, BB-056, BB-061 |
| [T-18](#t-18-source-adapter-drift) | Source adapter drift | BB-037–038, BB-047 |
| [T-19](#t-19-search-scraping-and-corpus-extraction) | Search scraping / corpus extraction | BB-023–026, BB-049, BB-059 |

Abuse cases and test mappings: [`abuse-cases.md`](./abuse-cases.md).  
Manual/automated checklist: [`tests/checklist.md`](./tests/checklist.md).  
Residual risk rollup: [Residual risk](#residual-risk).

---

## T-01 Volumetric and application-layer denial of service

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Cloud Armor/ALB rate controls; CDN for immutable snapshots; Cloud Run concurrency caps; degraded snapshot mode without origin fan-out |
| **Detective** | QPS/error/latency anomalies; per-route 429/5xx; cost burn-rate alerts |
| **Containment** | Kill switches for search/submissions/geocode/exports before wiping corpus; Armor emergency blocks; throttle non-essential workers |
| **Recovery** | Restore from last good release; IR rehearsal (BB-061); retune quotas |

**Beads:** BB-022, BB-023, BB-025, BB-033, BB-034, BB-035, BB-059 · **Abuse:** AC-01

## T-02 Cache-busting and expensive search attacks

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Normalize/strip cache-busting params; App Check on expensive reads; query complexity/timeouts/result caps; stricter search/geocode quotas |
| **Detective** | Cache hit-ratio and unique-query cardinality; per-client cost scoring; slow-query telemetry |
| **Containment** | Independent search/geocode kill switch; block abusive fingerprints; popular-query-only fallback |
| **Recovery** | Restore CDN rules; re-enable with tightened quotas after soak |

**Beads:** BB-023–026, BB-033, BB-049, BB-059 · **Abuse:** AC-02

## T-03 Credential stuffing and administrator phishing

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Admin = Auth + IAP + RBAC (not public+claim); MFA; separate admin identity where feasible |
| **Detective** | Failed login / impossible travel / new-device; IAP/Auth audit; anomalous admin API volume |
| **Containment** | Disable accounts; revoke sessions; publication kill switch; IAP break-glass lockdown |
| **Recovery** | Rotate credentials; audit BB-018 trail; rollback unauthorized releases |

**Beads:** BB-005, BB-011, BB-021, BB-027, BB-034, BB-035 · **Abuse:** AC-03

## T-04 Broken object and function-level authorization (BOLA/BFLA)

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Separate surfaces (BB-021); server-side authZ every request; object-level checks; DB role allowlists |
| **Detective** | 401/403 probe patterns; cross-surface token misuse; CI security suite (BB-036) |
| **Containment** | Revoke tokens; deny internal ingress; quarantine objects |
| **Recovery** | Patch authZ + regression; restore last good release; re-issue least-privilege creds |

**Beads:** BB-003, BB-013, BB-015, BB-019, BB-021, BB-027, BB-028, BB-036 · **Abuse:** AC-04

## T-05 Spam and coordinated correction brigading

| Quadrant | Controls |
|----------|----------|
| **Preventive** | App Check + rate limits; quarantine-first; volume ≠ truth; similarity clustering |
| **Detective** | Burst/entity-targeted dashboards; campaign heuristics; moderator backlog SLA |
| **Containment** | Submissions kill switch; auto-quarantine campaigns; elevate review on targeted entities |
| **Recovery** | Bulk reject; retract mistaken promotions; retune similarity/quotas |

**Beads:** BB-024, BB-025, BB-029, BB-032, BB-034, BB-055 · **Abuse:** AC-05

## T-06 Historical misinformation and source laundering

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Constitution gates; provenance/rights; lineage rejects circular inflation; promotion required |
| **Detective** | Dispute UI; gold corpus regressions; adversarial integrity (BB-060) |
| **Containment** | Hold/retract releases; disable adapters; promotion kill switch |
| **Recovery** | Corrected release + audit; update packs/adapters |

**Beads:** BB-003, BB-016, BB-017, BB-032, BB-037, BB-043, BB-047, BB-053, BB-060 · **Abuse:** AC-06

## T-07 Data poisoning through submissions and scraped sources

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Quarantine + promotion controls; research cannot publish; corroboration; source trust tiers |
| **Detective** | Single-lineage confidence jumps; adapter/domain spikes; promotion denial rates |
| **Containment** | Freeze promotion; quarantine adapter output; revoke trust tier |
| **Recovery** | Demote/purge tainted claims; replay from good evidence; add poison pattern to gold corpus |

**Beads:** BB-029, BB-032, BB-037, BB-039, BB-040, BB-044, BB-060 · **Abuse:** AC-07

## T-08 Malicious URLs, SSRF, redirects, DNS rebinding, oversized responses

| Quadrant | Controls |
|----------|----------|
| **Preventive** | No sync fetch in user requests; async fetcher with private-IP/DNS-rebind checks; redirect/size/time caps; egress isolation |
| **Detective** | Fetcher denial metrics; oversized/redirect-loop metrics; SSRF corpus tests |
| **Containment** | Disable fetch; quarantine URLs; domain deny lists |
| **Recovery** | Rotate reachable credentials; patch + regressions; re-scan quarantine |

**Beads:** BB-004, BB-029, BB-030, BB-033, BB-036, BB-065 · **Abuse:** AC-08

## T-09 Malicious file uploads

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Quarantine uploads (BB-031); type sniff + size + malware scan; non-public bucket; sandboxed viewers |
| **Detective** | Scanner hits; upload volume anomalies; polyglot detections |
| **Containment** | Upload kill switch; isolate bucket; revoke signed URLs |
| **Recovery** | Delete/re-encrypt objects; rotate signing keys; re-enable after fixes |

**Beads:** BB-005, BB-029, BB-031, BB-033, BB-036 · **Abuse:** AC-09  
**Note:** BB-031 is deferred — keep uploads disabled until quarantine boundary exists.

## T-10 Prompt injection inside researched documents

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Public render never calls LLM; LLMs cannot publish; tool/egress isolation (BB-065); prefer deterministic extraction |
| **Detective** | Tool-call/egress anomalies; human review on model proposals; injection eval fixtures |
| **Containment** | LLM/research-mode kill switch; quarantine documents; revoke model keys if exfil |
| **Recovery** | Discard unpromoted model claims; retract sole-injection promotions; harden firewall |

**Beads:** BB-030, BB-042, BB-044, BB-064, BB-065 · **Abuse:** AC-10  
**Note:** BB-064/065 deferred — do not enable tool-using research early.

## T-11 Dependency, GitHub Action, and CI supply-chain compromise

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Pin/allowlist Actions; OIDC/WIF; Dependabot + lockfiles; CODEOWNERS |
| **Detective** | Dependabot/secret scanning; unexpected workflow/Action changes; artifact provenance |
| **Containment** | Disable workflows; revoke OIDC; freeze deploys; rotate tokens |
| **Recovery** | Rebuild from known-good; redeploy prior release; tighten allowlists |

**Beads:** BB-006, BB-008, BB-009, BB-010, BB-036, BB-062 · **Abuse:** AC-11

## T-12 Secret leakage

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Secret Manager / 1Password; push protection; workload identity; log redaction |
| **Detective** | Secret scanning; anomalous credential use; client-bundle scanners |
| **Containment** | Revoke/rotate; disable SAs; feature kill switches |
| **Recovery** | Re-issue secrets; audit exposure window; history purge if needed |

**Beads:** BB-005, BB-009, BB-010, BB-011, BB-027, BB-034 · **Abuse:** AC-12

## T-13 Database exhaustion and connection starvation

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Pool caps + statement timeouts; read-only public role; search guardrails; reserved admin connections |
| **Detective** | Saturation/lock/CPU alerts; per-service pool dashboards; slow-query digests |
| **Containment** | Shed search load; kill runaway sessions; endpoint kill switches |
| **Recovery** | Restart pools; PITR if needed; query regressions; restore rehearsal |

**Beads:** BB-012, BB-013, BB-025, BB-026, BB-033, BB-034 · **Abuse:** AC-13

## T-14 Cloud bill exhaustion

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Budgets/hard quotas per env; bounded concurrency everywhere; dead-letter caps; separate research billing alerts |
| **Detective** | Burn-rate alerts; per-feature cost attribution; worker fan-out monitors |
| **Containment** | Kill research/LLM/geocode/exports; pause queues; emergency quota freeze |
| **Recovery** | Restore snapshot reads first; retune budgets; BB-059 cost soak gates |

**Beads:** BB-005, BB-022, BB-023, BB-025, BB-033, BB-034, BB-035, BB-059 · **Abuse:** AC-14

## T-15 Privacy attacks and attempts to expose living addresses

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Unknown ⇒ living; never public residential fields; projection schema excludes protected data; log redaction |
| **Detective** | Public DTO absence tests; anomalous sensitive-field access; privacy review (BB-057) |
| **Containment** | Immediate release rollback; geocode/nearby kill switch; quarantine entity |
| **Recovery** | Purge caches/CDN/logs where feasible; privacy runbook; CI fixtures from leak pattern |

**Beads:** BB-003, BB-015, BB-019, BB-028, BB-034, BB-036, BB-050, BB-057 · **Abuse:** AC-15

## T-16 Defacement and unauthorized publication

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Immutable releases + explicit activation; dual control/RBAC; private internal API; deploy gates |
| **Detective** | Audit every promotion; CDN hash drift; page on unexpected publication |
| **Containment** | Activate prior good release; publication kill switch; revoke publisher creds |
| **Recovery** | Forensic audit; corrected release + retraction; authZ regressions |

**Beads:** BB-018, BB-019, BB-021, BB-027, BB-032, BB-035, BB-044, BB-062 · **Abuse:** AC-16

## T-17 Insider mistakes and accidental publication

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Env isolation; confirmation/dry-run UX; staging-first; immutable rollback-as-switch |
| **Detective** | Pre-activation diffs; post-activation canaries; off-hours publication alerts |
| **Containment** | One-click prior release; disable further publications; page on-call |
| **Recovery** | Fix UX/process; BB-061 rehearsal; dual approval where mistakes recur |

**Beads:** BB-005, BB-018, BB-019, BB-027, BB-035, BB-044, BB-056, BB-061 · **Abuse:** AC-17

## T-18 Source adapter drift

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Versioned adapter contracts + query packs; fail-closed parse; rights checks |
| **Detective** | Parse-failure/null/volume cliffs; gold corpus diffs; sample checksums |
| **Containment** | Disable adapter; no auto-promote; alert CODEOWNERS |
| **Recovery** | Ship fixed version; quarantine drift-window captures; update fixtures |

**Beads:** BB-016, BB-037, BB-038, BB-045, BB-046, BB-047 · **Abuse:** AC-18

## T-19 Search scraping and corpus extraction

| Quadrant | Controls |
|----------|----------|
| **Preventive** | Rate limits + App Check; pagination caps; no unbounded public export; enumerate-resistant APIs |
| **Detective** | Sequential ID / high unique-entity rates; scraper clusters; atypical API vs web volume |
| **Containment** | Challenge/throttle; search/list kill switch; Armor ASN/IP blocks |
| **Recovery** | Retune after BB-059; ToS follow-up; product-approved watermarks only if accepted |

**Beads:** BB-023–026, BB-034, BB-049, BB-059 · **Abuse:** AC-19

---

## P0 → implementation bead map (summary)

| Threat | Must-land beads (non-exhaustive) |
|--------|----------------------------------|
| T-01 DoS | BB-023, BB-025, BB-033, BB-035 |
| T-02 Cache/search cost | BB-024, BB-025, BB-026 |
| T-03 Admin takeover | BB-021, BB-027 |
| T-04 BOLA/BFLA | BB-021, BB-027, BB-028, BB-036 |
| T-05 Brigading | BB-029, BB-032 |
| T-06 Misinfo | BB-003, BB-017, BB-032, BB-043 |
| T-07 Poisoning | BB-029, BB-032, BB-037 |
| T-08 SSRF | BB-030 |
| T-09 Uploads | BB-031 (deferred; keep off) |
| T-10 Prompt injection | BB-065 (deferred; keep LLM tools off) |
| T-11 Supply chain | BB-009, BB-010, BB-036 |
| T-12 Secrets | BB-009, BB-010, BB-011 |
| T-13 DB exhaustion | BB-012, BB-026, BB-033 |
| T-14 Bill exhaustion | BB-033, BB-035 |
| T-15 Living addresses | BB-003, BB-015, BB-019 |
| T-16 Unauthorized publish | BB-019, BB-027, BB-035 |
| T-17 Accidental publish | BB-005, BB-019, BB-035, BB-061 |
| T-18 Adapter drift | BB-037, BB-038, BB-047 |
| T-19 Scraping | BB-023, BB-025, BB-026 |

Full bead lists live in [`threat-corpus.json`](./threat-corpus.json).

## Residual risk

Every threat records residual risk in the corpus. Cross-cutting residuals:

1. **Public data is copyable.** Scraping cost can be raised; secrecy of released historical facts cannot be guaranteed (T-19).
2. **Perfect bot elimination is out of scope** (ADR-010). Aim for integrity and cost bounds (T-01, T-02, T-14).
3. **Human operators remain phishable and fallible**; dual control + fast rollback bound blast radius (T-03, T-16, T-17).
4. **Deferred features (uploads, tool-using LLMs) are high residual if enabled early** — keep disabled until BB-031 / BB-065.
5. **Controls are mostly unimplemented today** (scaffold). Treat this document as binding design, not evidence of production readiness.
6. **Third-party and historical sources may already expose living addresses**; Blap must not re-amplify them (T-15).

## Maintenance

- Amend corpus + this doc when a new threat class appears; tighten ADR-010 if assumptions change.
- BB-036 consumes abuse cases as CI gates; BB-059/060/061 validate load, integrity, and recovery.
- Do not claim Armor/App Check/IAP exist until their beads land and are verified.
