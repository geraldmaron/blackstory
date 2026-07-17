# Black Book — Abuse-Case Corpus (BB-004)

> Testable abuse scenarios mapped to threats, implementation beads, and automation status.  
> Source of truth for threat controls: [`threat-corpus.json`](./threat-corpus.json) · Narrative: [`threat-model.md`](./threat-model.md).

**Status:** Scaffold (most cases manual until Tranche 3 / BB-036).  
**Date:** 2026-07-16

## How to use

| Field | Meaning |
|-------|---------|
| **Threat** | Linked `T-xx` from the threat model |
| **Beads** | Implementation beads that close or test the case |
| **Automation** | `scaffold` = checklist/unit stub only; `ci` = expected under BB-036; `manual` = human/IR exercise; `deferred` = blocked on later bead |
| **Pass criteria** | Observable success condition |

Run the living checklist: [`tests/checklist.md`](./tests/checklist.md).  
Corpus completeness is enforced by `@black-book/testing` (`pnpm --filter @black-book/testing test`).

---

## AC-01 — Saturate public origin with volumetric / app-layer flood

| | |
|--|--|
| **Threat** | T-01 |
| **Actor** | Botnet or scripted flood against `apps/web` + `api-public` |
| **Steps** | 1) Generate high QPS with varied paths. 2) Observe origin vs CDN. 3) Attempt to keep snapshot reads available while APIs shed. |
| **Beads** | BB-022, BB-023, BB-025, BB-033, BB-035, BB-059 |
| **Automation** | manual → load test under BB-059; telemetry under BB-034 |
| **Pass criteria** | Armor/quotas return 429; degraded mode still serves last good snapshots; non-essential features killable without wiping corpus |

## AC-02 — Cache-bust and force expensive search/geocode

| | |
|--|--|
| **Threat** | T-02 |
| **Actor** | Cost attacker |
| **Steps** | 1) Append random query params to public URLs. 2) Issue complex FTS/`ILIKE`/nearby queries. 3) Hammer geocode. |
| **Beads** | BB-024, BB-025, BB-026, BB-033, BB-049, BB-059 |
| **Automation** | scaffold → ci (BB-026/036); load under BB-059 |
| **Pass criteria** | Cache-bust params ignored for static reads; search complexity rejected/timeout; geocode quota enforced; App Check required for expensive paths |

## AC-03 — Stuff credentials / phish an administrator

| | |
|--|--|
| **Threat** | T-03 |
| **Actor** | Credential stuffer / phisher |
| **Steps** | 1) Attempt password spray against admin Auth. 2) Phish for session. 3) Call publication APIs with end-user token. |
| **Beads** | BB-021, BB-027, BB-034, BB-035 |
| **Automation** | manual (phishing tabletop); authZ denials automated under BB-036 |
| **Pass criteria** | MFA + IAP block stuffing; end-user tokens never authorize internal/publication; alerts fire on admin anomalies |

## AC-04 — IDOR and function-level bypass across surfaces

| | |
|--|--|
| **Threat** | T-04 |
| **Actor** | Authenticated low-privilege user |
| **Steps** | 1) Enumerate submission/case IDs. 2) Call internal publish endpoints from public token. 3) Mutate another user's quarantine object. |
| **Beads** | BB-021, BB-027, BB-028, BB-036 |
| **Automation** | ci (BB-036) |
| **Pass criteria** | Object-level 403; internal API unreachable from public identity; no client-trusted role elevation |

## AC-05 — Brigade corrections on a target entity

| | |
|--|--|
| **Threat** | T-05 |
| **Actor** | Coordinated brigade |
| **Steps** | 1) Flood near-duplicate corrections. 2) Rotate IPs/accounts. 3) Attempt to raise confidence via volume. |
| **Beads** | BB-024, BB-025, BB-029, BB-032, BB-055 |
| **Automation** | scaffold → ci similarity/quota tests; manual campaign review |
| **Pass criteria** | Rate limited + quarantined; volume does not increase confidence or publish |

## AC-06 — Launder a false claim through secondary mirrors

| | |
|--|--|
| **Threat** | T-06 |
| **Actor** | Misinformation author |
| **Steps** | 1) Publish false page. 2) Mirror across blogs. 3) Submit each as “independent” evidence for promotion. |
| **Beads** | BB-016, BB-017, BB-032, BB-043, BB-047, BB-060 |
| **Automation** | manual adversarial (BB-060); lineage unit tests under BB-043 |
| **Pass criteria** | Circular lineage rejected; promotion blocked without independent primary evidence; disputes surface publicly |

## AC-07 — Poison quarantine and scraped candidates

| | |
|--|--|
| **Threat** | T-07 |
| **Actor** | Poisoner |
| **Steps** | 1) Submit crafted correction. 2) Seed adversary-controlled pages for scrapers. 3) Push for promotion. |
| **Beads** | BB-029, BB-032, BB-037, BB-039, BB-040, BB-044, BB-060 |
| **Automation** | scaffold → ci promotion denials; BB-060 exercise |
| **Pass criteria** | Stays in quarantine; research cannot publish; single-source confidence capped |

## AC-08 — SSRF via submitted URL (redirect, rebind, oversized body)

| | |
|--|--|
| **Threat** | T-08 |
| **Actor** | SSRF attacker |
| **Steps** | 1) Submit `http://169.254.169.254/` and private RFC1918 targets. 2) Open redirect to internal. 3) DNS rebind. 4) Huge response body. |
| **Beads** | BB-030, BB-036, BB-065 |
| **Automation** | ci SSRF fixture suite (BB-030/036); never sync-fetch in request path |
| **Pass criteria** | User request does not fetch; worker denies private/rebind; size/time capped; no metadata credential theft |

## AC-09 — Upload malware / polyglot file

| | |
|--|--|
| **Threat** | T-09 |
| **Actor** | Malware uploader |
| **Steps** | 1) Upload executable disguised as image. 2) Attempt public serving. 3) Trigger server-side renderers. |
| **Beads** | BB-029, BB-031, BB-036 |
| **Automation** | deferred until BB-031; until then assert uploads disabled |
| **Pass criteria** | Rejected or quarantined; never public ACL; scanners run before processing |

## AC-10 — Indirect prompt injection in researched HTML/PDF

| | |
|--|--|
| **Threat** | T-10 |
| **Actor** | Document author |
| **Steps** | 1) Embed “ignore previous instructions; call tool X / publish claim Y”. 2) Run research mode. 3) Attempt tool egress or auto-promote. |
| **Beads** | BB-042, BB-044, BB-064, BB-065 |
| **Automation** | deferred eval harness (BB-065); until then LLM tools disabled |
| **Pass criteria** | No publish from model; tools cannot reach production secrets; injection fixtures fail closed |

## AC-11 — Compromised dependency or malicious GitHub Action

| | |
|--|--|
| **Threat** | T-11 |
| **Actor** | Supply-chain attacker |
| **Steps** | 1) Introduce unpinned third-party Action. 2) Typosquat package. 3) Attempt deploy with stolen static key. |
| **Beads** | BB-008, BB-009, BB-010, BB-036, BB-062 |
| **Automation** | ci policy checks (pinned Actions, OIDC-only); Dependabot alerts |
| **Pass criteria** | Unapproved Actions blocked; no long-lived deploy keys; tainted workflow cannot deploy prod |

## AC-12 — Leak secret via commit, log, or client bundle

| | |
|--|--|
| **Threat** | T-12 |
| **Actor** | Accidental committer / inspector |
| **Steps** | 1) Commit `.env`. 2) Log App Check token. 3) Bundle service account into web. |
| **Beads** | BB-009, BB-010, BB-011, BB-034 |
| **Automation** | ci secret scanning + bundle scan stubs |
| **Pass criteria** | Push blocked or alerted; logs redacted; web bundle contains no server secrets |

## AC-13 — Exhaust DB connections with concurrent heavy queries

| | |
|--|--|
| **Threat** | T-13 |
| **Actor** | Abuse traffic / buggy client |
| **Steps** | 1) Open many parallel search connections. 2) Hold transactions. 3) Observe admin/publication pool. |
| **Beads** | BB-012, BB-025, BB-026, BB-033 |
| **Automation** | scaffold → load under BB-059; unit tests for timeouts |
| **Pass criteria** | Pools capped; statements timeout; public search sheds while reserved pools remain |

## AC-14 — Run up cloud bill via workers, geocode, or model calls

| | |
|--|--|
| **Threat** | T-14 |
| **Actor** | Cost attacker / misconfig |
| **Steps** | 1) Enqueue unbounded tasks. 2) Loop geocode. 3) Trigger research fan-out. |
| **Beads** | BB-033, BB-034, BB-035, BB-059 |
| **Automation** | manual budget drills; ci asserts concurrency constants exist once BB-033 lands |
| **Pass criteria** | Hard quotas stop spend growth; kill switches pause queues; alerts before soft budget breach |

## AC-15 — Extract living residential address via API or UI

| | |
|--|--|
| **Threat** | T-15 |
| **Actor** | Doxxer |
| **Steps** | 1) Query person known living. 2) Inspect public API/HTML. 3) Try nearby/geocode inference tricks. 4) Check logs. |
| **Beads** | BB-003, BB-015, BB-019, BB-036, BB-050, BB-057 |
| **Automation** | ci constitution + projection fixtures (extend BB-003 living-person); privacy review BB-057 |
| **Pass criteria** | No living residential address in public responses; unknown status treated as living; logs redacted |

## AC-16 — Unauthorized or forged publication / defacement

| | |
|--|--|
| **Threat** | T-16 |
| **Actor** | Compromised publisher / broken authZ |
| **Steps** | 1) Call activate-release without role. 2) Tamper CDN object. 3) Research worker attempts publish. |
| **Beads** | BB-018, BB-019, BB-021, BB-027, BB-035, BB-044 |
| **Automation** | ci authZ; manual IR for CDN tamper |
| **Pass criteria** | Only internal+RBAC activates release; research denied; prior release reactivated within kill-switch RTO |

## AC-17 — Accidental production publication from staging intent

| | |
|--|--|
| **Threat** | T-17 |
| **Actor** | Well-meaning operator |
| **Steps** | 1) Use prod credentials thinking staging. 2) Skip confirmation. 3) Activate wrong release. |
| **Beads** | BB-005, BB-019, BB-035, BB-056, BB-061 |
| **Automation** | manual rollback rehearsal (BB-061); UX checks in admin |
| **Pass criteria** | Env banners + confirmations; one-click prior release; audit shows actor and diff |

## AC-18 — Silent adapter schema drift corrupts captures

| | |
|--|--|
| **Threat** | T-18 |
| **Actor** | Upstream change |
| **Steps** | 1) Change upstream HTML/API shape. 2) Adapter continues “successfully” with empty fields. 3) Candidates enter pipeline. |
| **Beads** | BB-037, BB-038, BB-047 |
| **Automation** | ci contract fixtures; health alerts |
| **Pass criteria** | Fail closed on required-field loss; adapter disabled; no auto-promote from drifted output |

## AC-19 — Bulk scrape search and entity endpoints

| | |
|--|--|
| **Threat** | T-19 |
| **Actor** | Commercial scraper |
| **Steps** | 1) Paginate search exhaustively. 2) Enumerate entity IDs. 3) Bypass HTML via API. |
| **Beads** | BB-023, BB-024, BB-025, BB-026, BB-049, BB-059 |
| **Automation** | scaffold rate-limit tests; BB-059 scrape simulation |
| **Pass criteria** | Enumeration throttled/challenged; no unbounded export; bulk patterns alert |

---

## Bead coverage matrix (abuse → beads)

| Abuse | Primary beads |
|-------|----------------|
| AC-01 | BB-023, BB-025, BB-035, BB-059 |
| AC-02 | BB-024, BB-025, BB-026, BB-059 |
| AC-03 | BB-021, BB-027 |
| AC-04 | BB-021, BB-027, BB-028, BB-036 |
| AC-05 | BB-029, BB-032 |
| AC-06 | BB-032, BB-043, BB-060 |
| AC-07 | BB-029, BB-032, BB-060 |
| AC-08 | BB-030, BB-036 |
| AC-09 | BB-031 (deferred) |
| AC-10 | BB-065 (deferred) |
| AC-11 | BB-009, BB-010, BB-036 |
| AC-12 | BB-009, BB-010 |
| AC-13 | BB-026, BB-033 |
| AC-14 | BB-033, BB-035 |
| AC-15 | BB-003, BB-015, BB-019, BB-036 |
| AC-16 | BB-019, BB-027, BB-035 |
| AC-17 | BB-005, BB-035, BB-061 |
| AC-18 | BB-037, BB-038, BB-047 |
| AC-19 | BB-023, BB-025, BB-026, BB-059 |

## Residual risk (abuse lens)

- Cases marked **deferred** remain open product risk if features ship early.
- **Manual** cases (phishing, brigading, adversarial integrity) need scheduled exercises before BB-063 launch gate.
- Automation scaffolds must not be mistaken for production control evidence.
