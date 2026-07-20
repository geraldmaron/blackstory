# Mobile threat model

- **Bead**: `black-book-mobile-002` (MOB-002); acceptance gate `repo-5os2`
- **Date**: 2026-07-19 (accepted-with-amendments 2026-07-20)
- **Status**: **Accepted (with amendments)** — 2026-07-20 adversarial review; owner authorized decision-making after review + research
- **Prepared by**: mobile-program-review (agent); accepted under explicit owner authorization

> **Adversarial review disposition (2026-07-20).** Accepted with two amendments, both reconciling stated
> mitigations with verified repo/vendor reality:
> - **T2 fail-open is only partially implemented.** Read fail-open holds for **static reads** but NOT for
>   `expensive_read` (e.g. `/v1/search`): `@repo/security`'s quota matrix hard-denies unattested expensive
>   reads with no App Check outage carve-out — a real contradiction, candidly flagged in
>   `apps/mobile/src/security/app-check.ts` and tracked by **`repo-uqmm` (OPEN)**. See the amendment note in
>   T2. This is a **remaining risk open by design** pending a platform-wide owner/security decision.
> - **T6 code signing is a paid-EAS-plan feature.** EAS Update end-to-end code signing requires an EAS
>   Production/Enterprise plan (docs.expo.dev/eas-update/code-signing), so on the free tier the T6 blast-radius
>   controls are MFA custody + scoped CI token + staged rollout + rollback, and code signing is a cost-gated
>   upgrade. Also, `expo-updates` is not yet installed in `apps/mobile`, so the OTA path itself is a pending
>   MOB-019 task. See the amendment note in T6.

## Purpose and scope

This document extends the existing web/API security doctrine (`docs/adr/ADR-010-security-and-abuse-assumptions.md`)
to the native iOS and Android reader. It **does not contradict or loosen** ADR-010; where ADR-010
declared "mobile-specific security models" a non-goal for v1 ("contracts stay portable"),
this model provides the mobile-specific analysis that MOB-002 is now chartered to produce. It
inherits ADR-010's trust assumptions verbatim (the public internet is hostile; clients are
untrusted for authorization; anonymous users never write canonical data; degraded read-only
mode must survive attack; kill switches exist per feature class) and applies them to the mobile
attack surface.

### Program invariants this model is bound by

From `docs/mobile/mobile-app-epic.md` and `docs/mobile/decisions/mobile-identity.md`:

1. **Read boundary (invariant 2)**: `apps/api-public` is the *only* mobile read surface. No client
   touches canonical/research Firestore directly. Per ADR-011, public clients may read only
   released `public/**` projections and never write canonical, evidence, publication, audit, or
   operations paths; Firestore security rules enforce this client-closed boundary and privileged
   writes use the Admin SDK from Cloud Run with distinct service accounts.
2. **Client trust (invariant 6)**: App Check is **attestation, not authorization**. The server stays
   authoritative; a compromised client must not gain a canonical write path (there is none for any
   client) nor treat an App Check pass as an entitlement.
3. **Privacy (invariant 7)**: no ad/tracking SDKs; no query text, correction content, precise
   location, or sensitive entity classifications in logs or crash reports.
4. **Non-goals at launch**: no user accounts, push notifications, social features, or full offline
   basemap. This *reduces* the attack surface — there are no credentials to steal, no session to
   hijack, no social-graph abuse, and no privileged action any deep link or replayed request could
   trigger on behalf of a "user," because no user identity exists.

### Reusable server-side primitives referenced

The mobile API surface reuses the existing `@repo/security` enforcement helpers rather than
inventing parallel controls. Named primitives cited below (see `packages/security/src/`):
`DEFAULT_ENDPOINT_QUOTA_MATRIX`, `createRateLimitEvaluator` / `evaluateQuota`, `buildRateLimitKey`,
`RiskSignal` / `RiskSignalKind` (notably `missing_app_check`), `aggregateRiskScore`,
`safeRetryAfter` / `formatRateLimitResponse` (`rate-limits.ts`); `evaluateSearchQueryGuardrails`,
`DEFAULT_QUERY_GUARDRAIL_LIMITS`, `encodeSearchCursor` / `decodeSearchCursor`,
`assertNoProhibitedQueryFields` (`query-guardrails.ts`); `toPublicEntityProjection`,
`redactLocationForPublic`, `PROTECTED_FIELD_KEYS` (`redaction.ts` / `serialize.ts`);
`DEFAULT_SOFT_SHUTDOWN_POLICY` / `evaluateSoftShutdown`, `evaluateCircuitBreaker`,
`DEFAULT_DAILY_BUDGETS` / `evaluateDailyBudget` (`resource-controls.ts`).

### A note on referenced sibling ADRs

The bead references ADR-022 (mobile state/cache/offline) and ADR-023 (mobile build/release) as the homes for two
mitigations. **Both are drafted in this same MOB-002 pass and are now `Accepted (with amendments)` (2026-07-20)** (`docs/adr/ADR-022-*`,
`docs/adr/ADR-023-*`); they are pending the same red-team + owner acceptance as this model. This model still
**states each mitigation in its own words** so it stands alone, and the sibling ADRs ratify the mechanism: ADR-022
§4 ratifies the release-invalidation stamp (T5/T7) and ADR-023 §2/§6 ratify OTA custody, code signing, staged
rollout, and the drilled rollback (T6). Neither sibling weakens the requirements captured here — verified during
this review.

---

## T1 — Compromised / jailbroken / rooted client

**Threat.** The client binary is fully in the attacker's hands: it can be decompiled, its local
storage (SQLite cache, key–value prefs, files) read and rewritten, its network calls observed, and
any API request replayed with modified parameters from a rooted device or an off-device script.

**Attacker capability.** Full read/write of on-device state; ability to forge or omit any
client-supplied header (including the App Check token); ability to bypass App Check attestation
entirely on a sufficiently instrumented rooted device (Frida/hooking, emulator farms, or lifting a
valid token and replaying it).

**Impact if unmitigated.** If the server treated any client-supplied value (App Check pass, a
"role" flag, a cache-derived assertion) as an authorization decision, a rooted client could
escalate to reads or writes it should not have, or exfiltrate protected data.

**Mitigation.**
- **Nothing of value is stored on-device.** The SQLite cache holds only already-public,
  already-released projection data — the same bytes `apps/api-public` will serve to any anonymous
  caller. There are no secrets, no API keys beyond the public Firebase config (which is not a
  secret), no tokens with standing authority, and no accounts (launch non-goal). Reading the entire
  cache yields the attacker nothing they could not fetch legitimately. Precise coordinates and
  living-residential fields never reach the client in the first place, because the server applies
  `redactLocationForPublic` / `toPublicEntityProjection` (`PROTECTED_FIELD_KEYS`) *before*
  serialization — the redaction choke point is server-side, not a client responsibility.
- **App Check is a signal, never a gate for authorization (invariant 6).** The server MUST NOT
  branch any authorization decision on App Check pass/fail. It is consumed only as an abuse signal:
  a missing or failing token maps to the existing `missing_app_check` `RiskSignalKind`, feeds
  `aggregateRiskScore`, and at most tightens rate limits or trips anomaly detection. It never
  unlocks data or a write path. (This matches ADR-010 assumption 3, which scopes App Check to
  "sensitive public mutations and expensive reads" as *one* defense-in-depth layer, not the
  authorization decision.)
- **Server is authoritative on every parameter.** Replayed/modified requests are re-validated
  server-side against the same guardrails as any request (`evaluateSearchQueryGuardrails`,
  ID-format validation, approved query shapes). The client cannot widen its own quota, page size,
  radius, or field selection by editing the request.
- **No canonical write path exists for any client** (ADR-011 §7; invariant 6). Corrections
  (MOB-016) are submissions into a quarantine/promotion pipeline, never direct canonical writes.

**Accepted risk.** Attestation *can* be defeated on a rooted device. We accept this explicitly:
App Check raises the cost of automated abuse, it is not a wall. The security posture does not
depend on attestation being unbreakable, because attestation carries no authority (see mitigation).

**Evidence to close.** MOB-010 test proving the server ignores App Check state for authZ (identical
data returned with a valid token, an invalid token, and no token — differing only in
rate-limit/risk treatment); MOB-009 evidence that the SQLite schema stores only public projection
fields and no secret material; a decompilation/strings pass on a release build (MOB-021) confirming
no secret is embedded.

---

## T2 — App Check outage or misconfiguration

**Threat.** Firebase App Check is unavailable (Google outage), misconfigured (wrong key/rollout),
or a legitimate client's attestation fails transiently (network blip, clock skew, provider
throttling). This will happen; it is an availability event, not only an attack.

**Attacker capability.** None required — this is primarily a self-inflicted availability risk. An
attacker's only leverage is to *hope* we fail closed and thereby deny the public corpus to everyone.

**Impact if unmitigated.** If the API failed **closed** on missing/failing App Check, a provider
outage would lock every legitimate reader out of public historical content — converting a
third-party hiccup into a full product outage and handing attackers a denial-of-service lever.

**Mitigation.**
- **Fail OPEN for read-only public content, degrade to rate-limited access.** Because App Check is
  a signal and not an authorization gate (T1), a missing or unverifiable token on a read endpoint
  does not deny the request. It downgrades the caller: the request is served but treated as the
  lowest-trust `anonymous` subject and, when the `missing_app_check` signal is widespread or paired
  with other risk signals, subjected to tighter quotas via the existing evaluator. This mirrors
  ADR-010's degraded-read-only doctrine and its explicit rollback guidance: *"If App Check
  misconfiguration locks out users, fail to degraded snapshot reads rather than disabling all
  verification permanently."*
- **Fail closed only on a specific abuse signal**, not on the mere absence of attestation — e.g.
  when `aggregateRiskScore` crosses threshold for that key (`app_check_required` /
  `risk_score_exceeded` denial), or the mobile kill-switch (T9) is engaged.
- The `evaluateQuota` input already models this: `appCheckVerified` is an optional input and
  `missing_app_check` is a weighted risk signal, not a hard deny.

**Accepted risk.** During an App Check outage, automated-abuse cost temporarily drops to the
rate-limiter's floor. Accepted: the content is public and non-sensitive, and rate limits + budget
caps (T9) still bound exposure. Availability of the public corpus outranks maximal bot-resistance,
consistent with ADR-010.

**Amendment (2026-07-20) — fail-open is not fully implemented for expensive reads.** The mitigation above
is implemented for **static reads**, but `@repo/security`'s `evaluateQuota` currently **hard-denies
`expensive_read` (e.g. `/v1/search`) for callers without a verified App Check token, with no
outage/degraded-mode carve-out** — so during a genuine App Check outage a legitimate client's *search* is
denied, contradicting the fail-open intent stated here. This is verified in the shipped code and candidly
noted in `apps/mobile/src/security/app-check.ts`. Because the fix is a **platform-wide** change to
`packages/security` (shared with `apps/web`), it is an explicit owner/security decision, tracked by
**`repo-uqmm` (OPEN)**. Until resolved, this threat's fail-open guarantee should be read as scoped to
static reads; the client must surface the server's honest `429` for expensive reads rather than assume
fail-open. **Remaining risk, open by design.**

**Evidence to close.** MOB-010 test simulating App Check provider failure and asserting reads still
succeed (as `anonymous`, rate-limited) rather than 4xx-lockout; MOB-021 chaos/game-day exercise
toggling App Check off and confirming the app degrades to rate-limited reads, not a blank screen.

---

## T3 — API enumeration / scraping

**Threat.** `apps/api-public` is, by design (invariant 2), reachable by any mobile client and
therefore by any script impersonating one. An attacker walks IDs or pages to bulk-exfiltrate the
entity/evidence corpus via the mobile API surface.

**Attacker capability.** Unlimited unauthenticated requests from rotating IPs/devices; ability to
mimic the mobile client's headers exactly.

**Impact if unmitigated.** Whole-corpus scraping (a cost/DoS and integrity concern per ADR-010's
scraper assumption), and amplified server cost.

**Mitigation.** The mobile API reuses the web API's guardrails — there is no separate, weaker
"mobile" query path.
- **No unbounded list endpoints.** Every collection endpoint is cursor-paginated via
  `encodeSearchCursor` / `decodeSearchCursor`. Cursors are opaque and cryptographically bound to
  the canonical query hash, so an attacker cannot forge a cursor to jump scan position or change the
  query mid-walk.
- **Hard page-size ceiling and pagination-depth cap.** `DEFAULT_QUERY_GUARDRAIL_LIMITS` enforces
  `maxPageSize: 50` and `maxPaginationDepth: 20` (and `maxExportResults: 500`). Deep-walking the
  full corpus in one session is structurally prevented — beyond depth 20 the caller must issue a
  fresh narrowing query, which is itself rate-limited and cost-budgeted.
- **Approved query shapes only.** `assertNoProhibitedQueryFields` / `evaluateSearchQueryGuardrails`
  reject arbitrary field selection, user SQL, regex, wildcard-only queries, and unallowlisted sort
  keys — closing the "one giant query" exfiltration path.
- **Per-subject, per-endpoint quotas.** `DEFAULT_ENDPOINT_QUOTA_MATRIX` applies token-bucket +
  rolling-window + daily caps per `EndpointClass` (`entityRetrieval`, `sourceInspection`, `search`,
  `nearbyDiscovery`, `geocoding`), with the `anonymous` subject (all mobile callers) receiving the
  smallest quota. Distributed-abuse dimensions (`ip_burst`, `device_burst`, `endpoint_hopping`)
  feed `aggregateRiskScore` to catch IP-rotating scrapers.
- **Server-side redaction remains the backstop.** Even a fully-scraped corpus contains only public
  projection data; protected fields never leave the server (`PROTECTED_FIELD_KEYS`).

**Accepted risk.** A patient attacker within the rate limits can, over a long time, collect the
public corpus — which is *published to be read*. We bound cost and speed, not the eventual
readability of public history (ADR-010: "aim for cost and integrity bounds," not perfect bot
elimination). Integrity (no poisoning, no protected-field leak) is the hard guarantee; volume of
public reads is a cost guarantee.

**Evidence to close.** MOB-004 contract tests proving no list endpoint returns unbounded results
and every one requires a valid cursor past page 1; a load/abuse simulation (MOB-021, cf.
`simulateAbusiveTrafficPattern`) showing quotas and depth caps engage before corpus-scale
exfiltration.

---

## T4 — Deep-link injection

**Threat.** A malicious app, webpage, QR code, or message constructs a `blackstory://` URL or a
`blackbook.app` universal link with attacker-controlled parameters and lures a user into opening it
in the installed app.

**Attacker capability.** Full control of the link string and its parameters; the app will be handed
the URL by the OS.

**Impact if unmitigated.** If a deep link were used to build a raw query, select a route by
untrusted string, or trigger a privileged action, an attacker could redirect users to spoofed
content, drive expensive/abusive server queries on the victim's behalf, or crash the app with
malformed input.

**Mitigation.**
- **Route allowlist, not string dispatch.** A deep link resolves only to a *known, enumerated*
  route (e.g. the entity detail route behind `blackbook.app/e/{entityId}`, mirroring existing web
  routes per the identity doc). An unrecognized host/path/scheme opens the app's safe default
  surface — it is never dispatched dynamically.
- **Strict ID-format validation before use.** Any embedded identifier (`entityId`, etc.) is
  validated against its known format (character set + length) before it is used, and is passed only
  as a typed API path/parameter that flows through the same server-side guardrails as any
  request — **never** concatenated into a raw query, filter, or storage path.
- **No privileged action is reachable.** Because there are no accounts and no client-side mutations
  at launch (non-goals), there is *no* privileged operation a deep link could trigger — no
  "confirm," "delete," "purchase," or state-change target exists. A deep link can, at most, navigate
  to a public read view.
- **Universal-link domain binding.** Universal links are validated by the OS against the published
  `apple-app-site-association` / `assetlinks.json` (owned by us, per the identity doc); the custom
  `blackstory://` scheme, which any app can claim, is treated as strictly lower-trust and gets the
  same allowlist + validation — never more.

**Accepted risk.** The custom scheme can be registered by other apps (OS limitation); we accept
that a competing app could intercept `blackstory://` links. Mitigation is preferring universal
links for anything sensitive — but nothing sensitive travels in a link, so the residual impact is
limited to a navigation annoyance, not data exposure.

**Evidence to close.** MOB-008 tests feeding malformed/hostile deep links (bad IDs, unknown routes,
injection payloads, oversized params) and asserting safe-default navigation with no crash and no
raw-query construction; a fuzz corpus of link inputs in MOB-019 CI.

---

## T5 — Stale artifact / rollback replay ("resurrected" retracted content)

**Threat.** After a correction or retraction is published on the web, an old app build, a stale CDN
artifact, or stale cached data causes the mobile app to keep presenting the retracted content as if
current — the highest-integrity-cost failure for a truth-and-evidence product.

**Attacker capability.** May be a *bug* rather than an adversary (stale cache, missed
invalidation), or an attacker who pins an old artifact / forces offline (see T7) to keep a
retracted claim visible.

**Impact if unmitigated.** Mobile users see content the organization has formally corrected or
retracted — a direct violation of the correction posture the mobile app exists to match.

**Mitigation (requirement stated here; to be ratified in ADR-022).**
- **Release-invalidation stamp.** Every public read carries the server's current release stamp
  (monotonic release ID / pointer, per ADR-004 activation and ADR-011's active-release pointer).
  Cached entity data is tagged with the stamp under which it was fetched. When the server's stamp
  advances past the stamp a cached record was written under, that record is treated as stale and
  **dropped/refetched before display** — the client never renders cache data from a superseded
  release as current. A retraction, being a new release, advances the stamp and thereby invalidates
  every cached copy of the affected entity.
- **Corrections/retractions are not "soft" client state.** The client cannot mark content current;
  currency is derived solely from server stamp comparison, so a stale build cannot self-certify.
- **Build-level floor.** A minimum-supported-release / minimum-app-version signal from the server
  lets a retraction that requires a client-code change force an upgrade prompt rather than silently
  serving stale UI (ties to T6/ADR-023 release mechanics).

**Accepted risk.** A device that is *never* brought online again after a retraction cannot learn of
it — an unavoidable property of offline caches. Bounded by the honest degraded-mode UI (T7): such
content is shown as "last updated {date}, may be out of date," never as freshly verified.

**Evidence to close.** MOB-009 test advancing the server release stamp and asserting cached records
from the prior stamp are dropped/refetched before render; MOB-016 end-to-end test publishing a
retraction and confirming the mobile client stops presenting the retracted claim after its next
online read; **ADR-022 (Accepted with amendments, 2026-07-20)**, ratifying the stamp mechanism (§4).

---

## T6 — Compromised OTA (EAS Update) publish credentials

**Threat.** An attacker gains EAS Update publish credentials and ships malicious JavaScript to all
installed clients instantly, bypassing store review.

**Attacker capability.** Push arbitrary JS bundles to the production update channel; potentially
target all installs at once.

**Impact if unmitigated.** Mass compromise of the installed base — the single highest-blast-radius
mobile risk, because OTA reaches every device without a store gate.

**Mitigation.**
- **Credential custody with phishing-resistant MFA.** Per the identity doc's root-account custody
  requirement, the Expo/EAS organization requires phishing-resistant MFA (hardware security key or
  platform passkey), a recorded custody owner, and a recovery plan — the same hygiene mandated for
  Apple/Google/Firebase root accounts. Publish tokens are least-privilege, scoped, rotatable, and
  never embedded in the repo or CI logs.
- **EAS Update code signing.** Enable EAS Update's code-signing feature so clients verify a
  signature on each update bundle against a key the publish credentials alone cannot forge; a
  publish-credential theft without the signing key cannot ship an accepted bundle. **Amendment
  (2026-07-20):** code signing is supported on SDK 56 but is a **paid-plan feature** — "EAS Update Code
  Signing is only available to accounts subscribed to the EAS Production or Enterprise plans"
  (docs.expo.dev/eas-update/code-signing). On the free tier it is therefore **not** enabled by default;
  the blast-radius controls below (MFA custody, scoped CI-only token, staged rollout, immutable-update
  rollback) carry the risk, and enabling code signing is a **cost-gated upgrade trigger** (ADR-023 §7).
  Additionally, `expo-updates` is **not yet installed** in `apps/mobile`, so the OTA path itself is a
  pending MOB-019 task; until it is wired there is no OTA channel to compromise. **Remaining risk, open
  by design** on the free tier.
- **Channel/rollout discipline and rollback.** Updates go through preview → staged rollout, not an
  instant 100% production push (mirrors invariant 4: immutable artifacts, atomic activation, proven
  rollback). A malicious or bad update is revertible by re-pointing the channel to the last
  known-good bundle — the mobile analogue of ADR-010's "restore last known-good release."
- **Publish only from CI with scoped credentials**, so human laptops do not hold standing publish
  power (MOB-019).

**Accepted risk.** OTA is inherently higher-trust than store-reviewed native binaries; we accept OTA
for JS-only fixes precisely because code signing + rollback + MFA custody bound the blast radius.
Native-code changes still go through store review.

**Evidence to close.** MOB-019 evidence that EAS publish requires MFA'd, CI-scoped credentials and
(if supported) code-signing is enforced; a documented + drilled OTA rollback (MOB-021 rollback
drill); **ADR-023 (Accepted with amendments, 2026-07-20)** covering build/release/OTA custody and rollback (§2/§6) — note the T6 code-signing/`expo-updates` amendment above and `repo-ovn7`.

---

## T7 — Offline / degraded-mode downgrade attack

**Threat.** An attacker forces a client into offline or degraded mode (blocking API hosts, DNS
manipulation on a hostile network) to serve stale or manipulated cached content instead of live
data.

**Attacker capability.** Network-position control (hostile Wi-Fi, captive portal) to suppress live
calls; cannot alter server-side redaction or the corpus itself.

**Impact if unmitigated.** User sees stale content; if the UI presented it as *current*, the
attacker could keep a retracted claim visible (overlaps T5) or imply freshness that no longer
holds.

**Mitigation.**
- **Low value by construction.** All cached content is public, non-sensitive, already-released
  historical data (T1). Forcing offline mode reveals nothing an attacker could not read online and
  grants no write path. The attack's payoff is limited to *staleness*, not disclosure or tampering
  with server truth.
- **Degraded mode must be honest (invariant / ADR-022 requirement).** The app **never silently
  presents stale data as current.** Offline/degraded state is surfaced explicitly (offline banner,
  "last updated {timestamp}," disabled freshness-dependent affordances). Combined with the release
  stamp (T5), the client can tell it is behind and must say so.
- **Cache cannot be trusted over server on reconnect.** On regaining connectivity the client
  reconciles against the current release stamp (T5) before treating cached records as current.

**Accepted risk.** An attacker can degrade freshness on a hostile network; accepted because the
content is public and the UI's honesty requirement removes the deception payoff. We do not attempt
to guarantee live connectivity on adversarial networks.

**Evidence to close.** MOB-009/MOB-017 tests asserting every stale/offline render carries an honest
freshness indicator and no "verified/current" affordance; MOB-021 review confirming degraded mode
never masquerades as live.

---

## T8 — Native dependency supply-chain risk

**Threat.** A newly added React Native / Expo package with native code (or a transitive dependency)
is malicious, abandoned, or over-permissioned, importing risk directly into the shipped binary.

**Attacker capability.** Compromise or typosquat of an npm package; a legitimate package that
quietly requests platform permissions beyond our declared minimal footprint.

**Impact if unmitigated.** Malicious native code in the app; scope creep into permissions/SDKs the
privacy invariant forbids (ad/tracking SDKs, analytics, background location).

**Mitigation (review policy, enforced in MOB-019 CI).** Before any new native module is added,
reviewers MUST check:
- **Maintenance status** — recent releases, open-issue responsiveness, not archived/abandoned;
  single-maintainer or low-activity packages get extra scrutiny or a vendored/pinned alternative.
- **License** — compatible with distribution; no copyleft surprises.
- **Permission footprint** — the module must not request platform permissions or capabilities
  beyond the identity doc's minimal footprint: **no push, no accounts, no ad SDKs, no analytics**
  beyond privacy-safe observability (MOB-018), no background location, no contacts/photos unless a
  bead explicitly justifies it. Any new permission in the merged manifest is a review-blocking diff.
- **Provenance & pinning** — pinned versions, lockfile committed, integrity hashes; prefer
  Expo-vetted modules; audit transitive native deps, not just the top-level package.

**Accepted risk.** We cannot audit every transitive line; we bound risk by minimizing the native
dependency count, pinning, and gating manifest/permission diffs in CI. A one-maintainer team
accepts periodic dependency review over continuous supply-chain monitoring tooling.

**Evidence to close.** MOB-019 CI check that fails on undeclared permission additions to the
iOS/Android manifests and on new native modules lacking a recorded review; a documented dependency
review checklist applied to the launch dependency set (MOB-021).

---

## T9 — One-maintainer operational reality (scope boundary, not a gap)

**Threat framing.** This is a deliberate statement of what this threat model does and does not
require, so that unmet enterprise-security expectations are recorded as *accepted non-goals* rather
than discovered later as gaps.

**What this model does NOT require.** No 24/7 SOC, no dedicated security team, no on-call rotation,
no real-time SIEM, no continuous threat-hunting. ADR-010 already scopes v1 to "cost and integrity
bounds," not perfect prevention; the mobile program inherits that and the identity doc's
"runs-itself-within-reason" (budget-capped, kill-switch, free-tier-first) operating principle.

**What this model DOES require.**
- **A kill-switch for the mobile API surface.** If abuse is detected, the operator can disable or
  hard-throttle the mobile read path *without* wiping the public corpus — reusing the existing
  per-feature-class kill-switch and soft-shutdown posture (`DEFAULT_SOFT_SHUTDOWN_POLICY` /
  `evaluateSoftShutdown`, `evaluateCircuitBreaker`) rather than a bespoke mobile mechanism. This
  satisfies ADR-010's "kill switches exist per feature class … without defaulting to wiping the
  public corpus."
- **Budget caps with automated response.** `DEFAULT_DAILY_BUDGETS` / `evaluateDailyBudget` bound
  cost so a scraping/abuse spike degrades or sheds load automatically instead of running up an
  unbounded bill — the automation stands in for the absent on-call team.
- **Honest degraded mode (T2, T7)** so that engaging a kill-switch fails to rate-limited/offline
  reads, not a lockout.

**Accepted risk.** Response to a novel incident may be hours (single operator) rather than minutes.
Accepted and bounded: automated budget caps + kill-switch + immutable-release rollback contain
blast radius and cost while a human is unavailable, and no launch feature can cause canonical data
loss or living-person exposure even unattended.

**Evidence to close.** MOB-021 launch-gate proof that the mobile API kill-switch and daily budget
cap engage automatically under a simulated abuse spike and degrade (not delete) the public surface;
runbook entry naming the single operator and the recovery path.

---

## Threat → responsible-bead mapping

| # | Threat | Primary owning bead(s) | Mitigation implemented as |
|---|--------|------------------------|---------------------------|
| T1 | Compromised / rooted client | MOB-010 (security), MOB-009 (cache) | App Check as signal-only; no on-device secrets; server-authoritative validation |
| T2 | App Check outage / misconfig | MOB-010 (security) | Fail-open to rate-limited `anonymous` reads; fail-closed only on abuse signal |
| T3 | API enumeration / scraping | MOB-004 (API) | Cursor pagination, page-size/depth caps, quota matrix, approved query shapes |
| T4 | Deep-link injection | MOB-008 (nav/deep links) | Route allowlist + strict ID validation; no privileged target exists |
| T5 | Stale artifact / rollback replay | MOB-016 (corrections), MOB-009 (cache); **ADR-022** | Release-invalidation stamp; drop/refetch on stamp advance |
| T6 | Compromised OTA credentials | MOB-019 (CI/EAS); **ADR-023** | MFA custody, EAS code signing, staged rollout + rollback |
| T7 | Offline downgrade attack | MOB-009 (cache), MOB-017 (UX/a11y); **ADR-022** | Low-value public data + honest degraded-mode UI |
| T8 | Native dependency supply chain | MOB-019 (CI / native-dep review) | Maintenance/license/permission review gate; manifest-diff CI check |
| T9 | One-maintainer operational reality | MOB-018 (observability), MOB-021 (launch gate) | Mobile-API kill-switch + budget caps + automated soft-shutdown |
| — | Overall adversarial sign-off | MOB-021 (launch gate) | Red-team review, abuse simulation, rollback drill converge here |

*ADR-022 (mobile state/cache/offline) and ADR-023 (mobile build/release) are `Accepted (with amendments)` (2026-07-20)
from this MOB-002 pass; T5, T6, and T7 verified that they ratify — and do not weaken — the requirements stated above
(T6's code-signing/`expo-updates` gap is amended above and tracked by `repo-ovn7`).*

---

## Red-team resolution — App Check posture on MOB-016 correction submission

*Resolved: MOB-016 correction submission **fails open with the strictest quota**, not fail-closed, when App Check
is unavailable — but it is the **first surface shed** under abuse and remains fully gated by the quarantine
pipeline.* (MOB-002 requires recorded reviewer findings and dispositions.)

The reviewer accepted this model's lean, with corrections-specific tightening made explicit:

- **Fail open, not closed.** A missing/unverifiable App Check token on the correction endpoint does **not** hard-deny
  the submission. Failing closed would deny an availability-sensitive civic function — letting people report errors
  in historical records — during a Google/App Check *outage*, to defend a boundary App Check was never the real
  guard for. The actual defenses stand regardless of attestation: the submission is **quarantine-only and cannot
  publish** (ADR-005; never a canonical write — invariant 6), and per-subject/per-endpoint rate limits, budget
  caps, and the promotion-review pipeline all remain in force.
- **Corrections get the *strictest* quota and shed first.** Because a write-shaped endpoint is a higher-value abuse
  target than a read, the submissions endpoint class receives the tightest tier of `DEFAULT_ENDPOINT_QUOTA_MATRIX`,
  and a widespread `missing_app_check` signal (or `aggregateRiskScore` crossing threshold) tightens or trips it
  **before** it would a read path — and the mobile kill-switch (T9) can disable correction intake independently
  while leaving public reads up. So availability is preserved for the common case, but corrections are the first
  thing throttled/shed under a genuine abuse spike.
- **Client-offline is a separate, already-honest case.** ADR-022 §3 disables correction submission when the
  *client* is offline (with a clear "needs connection" message) and never queues its content to disk (invariant 7).
  That is orthogonal to server-side App Check availability decided here; the two are consistent — neither ever
  silently drops or fabricates a correction.

This keeps corrections consistent with ADR-010's degraded-mode doctrine (availability of a public civic function
outranks maximal spam-resistance) without weakening the real integrity boundary, which was never attestation.
