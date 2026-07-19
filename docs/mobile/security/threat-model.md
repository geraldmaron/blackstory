# Mobile threat model

- **Bead**: `black-book-mobile-002` (MOB-002)
- **Date**: 2026-07-19
- **Status**: Proposed pending red-team review (MOB-021 adversarial launch gate)
- **Prepared by**: mobile-program-review (agent)

## Scope and doctrine

This document extends the existing web/API threat doctrine to the native iOS/Android
reader. It does not restate or contradict it; where a rule already exists, it is cited:

- **ADR-010** (security and abuse assumptions): the public internet is hostile; anonymous
  users never write canonical data; browser/mobile clients are untrusted for
  authorization; immediate read-only degraded mode; per-feature-class kill switches that
  never default to wiping the public corpus; App Check is defense-in-depth, not authZ.
- **ADR-011** (Firestore system of record): public clients read only released `public/**`
  projections through `apps/api-public`; they never touch canonical, evidence,
  publication, audit, or operations paths. Mobile inherits this — there is no mobile
  Firestore SDK path to canonical data.
- **ADR-004** (immutable publication snapshots): each publication is an immutable release
  with a signed manifest (content hashes) and a search-index version; activation is
  atomic; rollback flips the active release pointer; public API responses carry
  release/revision metadata. This is the anchor for stale-artifact and rollback threats.
- **Mobile program invariants** (`docs/mobile/mobile-app-epic.md`): invariant 2 (`apps/api-public`
  is the sole read boundary), invariant 4 (immutable releases, proven rollback),
  invariant 6 (App Check is attestation, not authorization), invariant 7 (privacy: no
  ad/tracking SDKs; no query text, correction content, precise location, or sensitive
  classifications in logs/crash reports), and the launch non-goals (no accounts, push,
  social, or full offline basemap).

The concrete server-side enforcement primitives cited below are real exported symbols in
`packages/security` (scope `@repo` — the identity doc's `@repo` note is correct; verified
via `grep '"name"' packages/*/package.json`). The mobile client does not re-implement any
of them; it consumes the `apps/api-public` surface those primitives already protect.

Because there are **no user accounts at launch**, the mobile client holds no bearer token,
no session, and no personal data of value. Every threat below is evaluated against a
subject whose entire local state is a cache of already-public, already-released content.

---

## Threat 1 — Compromised / jailbroken / rooted client

- **Threat**: The app binary is decompiled, on-device SQLite storage is read, and outbound
  API calls are replayed with modified parameters (IDs, cursors, filters, geo bounds).
- **Attacker capability**: Full control of a rooted/jailbroken device and the process:
  can read the app sandbox, extract any embedded config, tamper with the JS bundle at
  rest, hook TLS to observe/replay requests, and forge or strip the App Check attestation
  token. Assume App Check *can* be bypassed by a sufficiently motivated attacker on a
  rooted device.
- **Impact if unmitigated**: If App Check pass/fail were treated as an authorization
  decision, a bypass would "unlock" whatever it gates. If the cache held secrets, they
  would leak.
- **Mitigation**: Two structural facts, not a control that can be bypassed.
  1. **No secrets of attacker value exist client-side.** The SQLite cache (MOB-009)
     stores only released `public/**` projection data — the same bytes any anonymous
     reader already receives from `apps/api-public`. No API keys, no service credentials,
     no other user's data, no canonical/evidence records (ADR-011 invariant 7; ADR-004).
     Decompiling the binary and dumping the cache yields nothing that is not already
     public. Reduce-to-public happens server-side before serving via `@repo/security`
     (`redactLocationForPublic`, `toPublicEntityProjection`,
     `assertNoProhibitedPublicPrecision`), so no precise-location or living-person data is
     ever present to exfiltrate from the device.
  2. **App Check is a signal, never a gate for anything sensitive** (invariant 6, ADR-010
     trust assumption 3). In `evaluateQuota` (`packages/security/src/rate-limits.ts`) the
     `appCheckVerified` flag and the `missing_app_check` `RiskSignalKind` feed
     *rate-limiting and anomaly scoring* (`aggregateDistributedRisk`), not an
     authorization branch. A missing/forged attestation lowers the caller's quota and
     raises their risk score; it never grants access to a privileged path, because no
     privileged path is reachable from the public surface. Replayed requests with modified
     parameters are re-validated server-side on every call
     (`evaluateSearchQueryGuardrails`, `assertNoProhibitedQueryFields`) exactly as if they
     came from `curl` — the client is never trusted to have validated anything.
- **Accepted residual risk**: A rooted attacker can consume public data at the anonymous
  quota and can forge attestation to look like a "clean" client, marginally degrading the
  fidelity of the abuse signal. Accepted: the signal is probabilistic by design; integrity
  rests on server-side re-validation and quotas, not on attestation.
- **Evidence to close**: Cache-contents audit showing only public projection fields; a
  test proving the server rejects a replayed request whose parameters were tampered with
  (modified ID, over-limit `pageSize`, forged cursor); confirmation that no code path
  reads App Check result as a boolean authorization gate.

---

## Threat 2 — App Check outage or misconfiguration (read paths)

- **Threat**: App Check is down, misconfigured, or a legitimate client's attestation fails
  transiently, and legitimate readers get locked out of public content.
- **Attacker capability**: None required — this is primarily an availability/self-inflicted
  risk. An attacker could try to *induce* it, but gains nothing (see Threat 7).
- **Impact if unmitigated**: A fail-closed posture on read paths would take the public
  historical corpus offline for honest users on a third-party attestation dependency —
  directly violating ADR-010's "immediate read-only degraded mode" requirement.
- **Mitigation — fail OPEN for read-only public content.** This is already how the shared
  evaluator behaves and must be preserved on the mobile surface:
  - Static reads (`entityRetrieval`, `sourceInspection` — cost tier `static_read` in
    `DEFAULT_ENDPOINT_QUOTA_MATRIX`) are **not** gated on `appCheckVerified` in
    `evaluateQuota`; only `expensive_read` and `mutation` tiers require it. So entity and
    evidence reads continue to serve when attestation is unavailable, degraded to the
    ordinary anonymous rate limit rather than blocked.
  - When App Check is unavailable, expensive reads (`search`, `geocoding`,
    `nearbyDiscovery`) degrade to a **reduced anonymous quota**, not a hard block, unless a
    specific abuse signal (a `RiskSignal` pushing `aggregateRiskScore` past
    `riskScoreThreshold`) is present for that caller. Absence of attestation alone is a
    weak signal; concrete bursty behaviour is the strong one.
  - ADR-010 rollback consideration is explicit: "If App Check misconfiguration locks out
    users, fail to degraded snapshot reads rather than disabling all verification
    permanently." Mobile honors this by rendering from the SQLite cache / release snapshot
    (ADR-004 public JSON snapshots) when the live API degrades.
- **Evidence to close**: A test/dashboard showing that with App Check forced-unavailable,
  `entityRetrieval` and `sourceInspection` still return 200 at the anonymous quota and only
  expensive/mutation classes throttle; a device recording of degraded-mode read from cache.

---

## Threat 3 — API enumeration / scraping via the mobile surface

- **Threat**: `apps/api-public` is public-reachable from mobile, so an attacker points a
  script at the same endpoints the app uses to bulk-exfiltrate the entity/evidence corpus.
- **Attacker capability**: Unlimited request volume from rotating IPs/devices, using the
  app's own (reverse-engineered) request shapes.
- **Impact if unmitigated**: Wholesale scraping of the corpus at high rate; cost
  amplification on expensive read paths.
- **Mitigation — the mobile surface adds no new bulk-egress path; it reuses the same
  bounded contract.** Concretely, from `packages/security`:
  - **No unbounded list endpoints.** Every list/search response is paginated through
    **opaque cursors** (`encodeSearchCursor` / `decodeSearchCursor`), and the cursor is
    cryptographically bound to the query hash via `timingSafeEqual` — an attacker cannot
    hand-craft a cursor to jump arbitrarily deep or re-key it onto a different query.
  - **Hard page-size and depth ceilings.** `DEFAULT_QUERY_GUARDRAIL_LIMITS` caps
    `maxPageSize` at 50 and `maxPaginationDepth` at 20 (and `maxExportResults` at 500);
    `evaluateSearchQueryGuardrails` rejects `page_size_exceeded` /
    `pagination_depth_exceeded`. Deep pagination past depth 20 is simply refused, so the
    corpus cannot be walked page-by-page without limit.
  - **Per-subject, per-endpoint quotas.** `evaluateQuota` against
    `DEFAULT_ENDPOINT_QUOTA_MATRIX` enforces token-bucket + rolling-window + daily-cap +
    concurrency caps keyed by `buildRateLimitKey` (subject × endpoint × device/session/IP).
    Anonymous `entityRetrieval` is 40/min and 300/day; `search` is 8/min and 40/day —
    scraping the corpus at these caps is economically and temporally impractical.
  - **Distributed-abuse aggregation.** `aggregateDistributedRisk` scores cross-dimension
    signals (`ip_burst`, `device_burst`, `endpoint_hopping`, `missing_app_check`) so a
    single attacker spreading across many IPs/devices still trips the risk threshold.
  - **Query-shape allowlist.** `assertNoProhibitedQueryFields` rejects `sql`, `regex`,
    `fields`/`select`, and `orderBy`, so no attacker-defined projection or ordering can
    turn a bounded endpoint into a bulk export.
- **Accepted residual risk**: A patient attacker can still slowly harvest public data
  within the quotas over a long period. Accepted — the data is already public and released;
  the goal (ADR-010 non-goal) is cost/integrity bounds, not perfect anti-scraping.
- **Evidence to close**: Contract tests proving `pageSize > 50` and `depth > 20` are
  rejected on the mobile-consumed endpoints; a load test showing anonymous quotas throttle
  a scraping loop; confirmation the mobile client requests no endpoint outside the bounded
  v1 contract.

---

## Threat 4 — Deep-link injection

- **Threat**: A malicious app, webpage, QR code, or message constructs a `blackstory://` or
  `https://blackbook.app/...` universal link with attacker-controlled parameters and lures
  the user into opening it.
- **Attacker capability**: Can craft arbitrary link strings and get them onto the device;
  cannot control what the app *does* with them beyond what the routing layer permits.
- **Impact if unmitigated**: If a deep link could construct a raw query, address an
  arbitrary backend path, or trigger a privileged action, it would be an injection/SSRF or
  privilege-escalation vector.
- **Mitigation — strict resolve-then-validate routing (MOB-008).**
  - A deep link resolves only to a **known, enumerated route** (e.g. `/e/{entityId}`,
    `/source/{sourceId}`, `/search`). Unknown routes fall back to the app home, never to a
    dynamic handler.
  - The route parameter must pass **format validation** (ID shape/charset, cursor decoded
    through `decodeSearchCursor`, search text through `evaluateSearchQueryGuardrails`)
    before any fetch. A malformed ID is rejected client-side and re-rejected server-side;
    it never becomes a raw query string or an arbitrary URL.
  - Deep links **never trigger a privileged or mutating action**. There is no privilege to
    escalate to: **no accounts, no session, no write path reachable from a link** at launch
    (MOB-001 non-goals). The single write surface (corrections, MOB-016) is only reachable
    through explicit in-app user action with its own validation and App Check gate — it is
    not deep-link-addressable. This is stated explicitly so the "no privilege" assumption
    is an intentional invariant, not an accident that a future feature could silently break.
  - Universal-link association (`apple-app-site-association`, `assetlinks.json`) is
    published only for `blackbook.app` (MOB-001), so only first-party links are claimed by
    the app.
- **Evidence to close**: Tests that (a) an unknown route/host falls back safely, (b) a
  malformed ID is rejected before any network call, (c) no deep link reaches the
  corrections submit path; a re-review gate to re-assert "no privileged link action" if
  accounts are ever introduced (MOB-022).

---

## Threat 5 — Stale artifact / rollback replay (resurrected retracted content)

- **Threat**: After a correction/retraction is published on web, an old app build or old
  cached release data continues to serve the *retracted* version of an entity, presenting
  removed or corrected content as current.
- **Attacker capability**: Can force a client offline (Threat 7) or exploit lazy cache
  invalidation to keep stale bytes alive; can also downgrade to an old app build.
- **Impact if unmitigated**: The app shows content the publisher has explicitly retracted —
  a correctness and dignity failure, the exact harm the correction pipeline exists to
  prevent.
- **Mitigation — release-stamp-driven invalidation, anchored to ADR-004.** ADR-004
  establishes an immutable release model with an **active release pointer**, a **signed
  release manifest (content hashes)**, atomic activation, and **release/revision metadata
  on every public API response**. The mobile cache (MOB-009) must treat that release stamp
  as a monotonic invalidation clock. (ADR-022 — mobile state/cache/offline — does not yet
  exist in this worktree; the requirement below is stated in its own words and should be
  formalized there.)
  - **Requirement**: cached entity data is stamped with the release ID it was fetched
    under. When the server's active release pointer advances (observed via the
    release/revision metadata on any response, or a lightweight release-stamp check), any
    cached entity whose stamp predates the advance **must be dropped and refetched** before
    it is shown as current — specifically so a retraction published in a newer release
    invalidates the resurrected older copy.
  - **Rollback safety**: because activation is atomic and the pointer only ever names an
    immutable release (ADR-004), the client never composes a half-old/half-new view; it
    either has the current release's copy or refetches.
  - **Old-build safety**: a build too old to understand the current contract/release stamp
    must degrade to "cannot verify freshness" honesty (Threat 7) and prompt update, rather
    than silently serving its stale snapshot as current. Minimum-supported-version
    enforcement belongs to MOB-021/MOB-019.
- **Evidence to close**: A test where publishing a retraction in release N+1 causes a
  client holding release-N cache to drop and refetch the affected entity; confirmation the
  API returns release/revision metadata the client keys on; ADR-022 written to ratify the
  stamp-invalidation rule.

---

## Threat 6 — Compromised OTA (EAS Update) publish credentials

- **Threat**: An attacker who obtains EAS Update publish credentials ships malicious
  JavaScript to every installed client instantly, bypassing store review.
- **Attacker capability**: Full publish rights to an update channel; can push arbitrary JS
  to the production channel until detected and revoked.
- **Impact if unmitigated**: Instant, wide-blast-radius compromise of all installs — the
  single highest-severity mobile-specific supply-chain risk.
- **Mitigation — credential custody + MFA + immutable-rollback plan.** (ADR-023 — mobile
  build/release — does not yet exist in this worktree; the requirements below are stated in
  their own words and should be ratified there.)
  - **Credential custody** per MOB-001 "root account custody": the Expo/EAS organization
    requires phishing-resistant MFA (hardware security key or platform passkey), a recorded
    custody owner, and a recovery plan — the same hygiene required for Apple/Google/Firebase
    root accounts. Publish credentials are never embedded in client builds or committed to
    the repo.
  - **Least privilege + provenance**: OTA publishing runs only from the CI pipeline
    (MOB-019) with scoped credentials, not from personal laptops; every published update is
    attributable to a CI run and commit.
  - **Rollback plan**: EAS updates are immutable and channel-addressable. The response to a
    malicious or bad update is to **republish the previous known-good immutable update to
    the channel** (a forward-roll to the prior artifact), consistent with invariant 4
    (proven rollback) and ADR-004's "activate a prior immutable release" philosophy — never
    an in-place edit of a live artifact.
  - **Blast-radius limits**: OTA carries JS/asset changes only; native binary changes still
    require store review. Rollout should be staged (MOB-021) so a bad update is caught on a
    fraction of installs before full fan-out. The mobile API kill-switch (Threat 9) can
    additionally throttle the surface while a bad update is rolled back.
- **Evidence to close**: Documented EAS credential custody + MFA record (MOB-001 gate); a
  rehearsed rollback drill republishing the prior update to the channel (MOB-021); proof
  OTA publishes only from CI; ADR-023 written to ratify the custody + rollback rule.

---

## Threat 7 — Offline / degraded-mode downgrade attack

- **Threat**: An attacker forces a client into offline or degraded mode (e.g. blocking the
  API host on a hostile network) to make it serve stale or manipulated cached content.
- **Attacker capability**: Network position (captive portal, hostile Wi-Fi) to selectively
  block or delay `apps/api-public`; cannot forge TLS-authenticated responses.
- **Impact if unmitigated**: Low intrinsic value — the cached content is public,
  non-sensitive historical data, so there is little to "steal" or usefully manipulate. The
  real risk is a **dishonest UI** that presents stale bytes as current/verified.
- **Mitigation — honest degraded-mode UI, never silent staleness.**
  - When live fetch fails or the release stamp cannot be confirmed, the UI must clearly
    indicate offline/degraded state and the as-of release/time of the cached content — it
    must **never present stale data as current** (invariant 7 honesty; ADR-010 degraded
    read-only mode).
  - TLS pinning/standard transport security prevents an on-path attacker from substituting
    forged content; the attacker can only withhold responses, not rewrite them. So the
    worst achievable outcome is "user sees clearly-labeled cached data," not "user sees
    attacker content believed current."
  - Freshness is bounded by the Threat 5 release-stamp rule: on reconnect, stamps advance
    and retracted content is dropped.
- **Accepted residual risk**: A user on a hostile network may be kept on labeled stale
  content indefinitely. Accepted — the content is public and non-sensitive, and the UI is
  honest about its staleness.
- **Evidence to close**: A device recording showing degraded mode labels cached content
  with its as-of release and never claims currency; confirmation transport security blocks
  content substitution.

---

## Threat 8 — Native dependency supply-chain risk

- **Threat**: A newly added native module (or a compromised update to an existing one)
  introduces malicious code, excessive permissions, or an unvetted transitive dependency.
- **Attacker capability**: Publishing to a package the project depends on, or convincing a
  maintainer to add a hostile module.
- **Impact if unmitigated**: Native code runs with app privileges; a hostile module could
  exfiltrate data, request dangerous platform permissions, or violate privacy invariant 7.
- **Mitigation — a pre-add review policy for native modules (MOB-019 CI / native-dep
  review).** Before any new native module is added:
  1. **Maintenance status**: actively maintained, non-trivial adoption, recent releases,
     responsive to security issues; abandoned modules are rejected.
  2. **License**: compatible permissive license, recorded; copyleft/native-linking or
     ambiguous licenses require explicit sign-off.
  3. **Requested platform permissions**: enumerate the iOS/Android permissions the module
     forces into the manifest/Info.plist; anything beyond what the reader genuinely needs
     is rejected. In particular the launch posture **forbids**: push/notification SDKs, any
     accounts/identity SDK, ad or attribution SDKs, and analytics beyond privacy-safe
     observability (MOB-018, invariant 7). A module that pulls any of these in transitively
     is rejected.
  4. **Transitive footprint & provenance**: review the dependency's own tree and lockfile
     pinning; prefer Expo-config-plugin-managed native code over hand-linked modules.
- **Accepted residual risk**: A future compromise of an already-vetted dependency is not
  fully preventable pre-add; caught downstream by lockfile pinning, CI audit, and staged
  rollout (MOB-019/021), not by a real-time SOC.
- **Evidence to close**: A written native-dependency review checklist in CI docs; the
  current dependency set audited against it with permissions enumerated; a CI job that
  fails on an unreviewed native module or a forbidden SDK category.

---

## Threat 9 — One-maintainer operational reality (scope boundary)

- **Threat**: Framing the mobile surface as if it were defended by a staffed security
  organization, creating obligations a solo maintainer cannot meet — and thereby leaving
  the *actually necessary* control unbuilt.
- **This is a stated non-goal boundary, not a gap.**
- **What this threat model does NOT require**: a 24/7 SOC; a dedicated security team;
  real-time incident response; on-call rotation; bespoke anti-bot/anti-fraud infrastructure;
  perfect bot elimination (ADR-010 non-goal). These are explicitly out of scope for a
  budget-capped, single-maintainer, U.S.-only reader with no accounts and no user data of
  value.
- **What it DOES require — an automated kill-switch for the mobile API surface**,
  consistent with this project's existing budget-capped / kill-switch automation posture:
  - Per-feature-class kill switches already exist as doctrine (ADR-010 assumption 4) and as
    automated budget responses in `packages/security/src/resource-controls.ts`:
    `evaluateDailyBudget` + `DEFAULT_DAILY_BUDGETS` pair each budget with a
    `BudgetAutomatedResponse` (e.g. `throttle_optional`, `disable_geocoder`), and
    `evaluateSoftShutdown` / `DEFAULT_SOFT_SHUTDOWN_POLICY` shut optional tiers down before
    public serving while **never auto-disabling the public corpus**
    (`autoDisablePublicCorpus: false`, `preserveTiers: ['public_serving']`).
  - The mobile surface must be reachable by the same automation: if abuse or cost runaway is
    detected on `api-public` from mobile traffic, an operator (or an automated budget
    trigger) can throttle or disable the expensive mobile-facing classes and let the client
    degrade to cached/snapshot reads (Threat 2/7) — without a human watching a console at
    3am. `api-public` also has a finite `maxInstances` cap (`DEFAULT_SERVICE_SCALING_LIMITS`,
    `evaluateScalingCap`) so hostile traffic cannot scale cost without bound.
- **Evidence to close**: Confirmation the mobile-facing `api-public` classes are wired to
  the existing kill-switch/budget automation; a rehearsed drill (MOB-021) toggling the
  mobile surface off and observing honest client degradation; explicit sign-off that no
  SOC/on-call is a launch requirement.

---

## Resolved open question — App Check availability on the write path (corrections)

**Question**: Should MOB-016 correction submission (the *only* non-read mobile surface)
fail open like reads, or fail closed, when App Check is unavailable?

**Decision: FAIL CLOSED for the one write path.** Corrections submission must require a
valid App Check attestation; if attestation is unavailable, the submission is refused (with
an honest "try again later" message), it is **not** waved through.

**Justification**:
- Reads fail open because the corpus is public, high-volume, and non-sensitive — blocking
  reads harms honest users and protects nothing (Threat 2). Corrections are the **opposite
  profile**: low-volume, abuse-sensitive, and the entry point to the moderation/promotion
  pipeline. Waving them through on attestation outage would open a spam/poisoning funnel
  (ADR-010 assumption 9, "volume ≠ truth") precisely when the bot signal is blind.
- This matches the existing shared evaluator: in `evaluateQuota`, the `corrections`
  endpoint class is cost tier `mutation`, and an anonymous `mutation` without
  `appCheckVerified` already returns `app_check_required` — i.e. the platform *already*
  fails closed for anonymous writes. Mobile inherits that behaviour rather than special-casing it.
- Blast radius of failing closed here is small and self-limited: a user simply cannot file a
  correction until attestation recovers; no reading, browsing, or map functionality is
  affected. Corrections are also already the most tightly quota'd class (anonymous: 2/min,
  8/day) and are validated/spam-scored server-side (`validateAndNormalizeSubmission`,
  `scoreSubmissionSpam`, `createSubmissionCampaignDetector`,
  `DEFAULT_SUBMISSION_VALIDATION_LIMITS`), so fail-closed is consistent with how the write
  path is already defended.

This is the one deliberate exception to the fail-open default, and it is intentional.

---

## Threat → responsible bead map

| # | Threat | Mitigation owner bead |
|---|--------|-----------------------|
| 1 | Compromised / rooted client | MOB-010 (security), MOB-009 (cache) |
| 2 | App Check outage — read paths fail open | MOB-010 (security), MOB-004 (API) |
| 3 | API enumeration / scraping | MOB-004 (API) |
| 4 | Deep-link injection | MOB-010 (security) — routing in MOB-008 |
| 5 | Stale artifact / rollback replay | MOB-016 (corrections) + MOB-009 (cache) |
| 6 | Compromised OTA update credentials | MOB-019 (CI/EAS) — custody per MOB-001 |
| 7 | Offline downgrade attack | MOB-009 (cache) — honest UI |
| 8 | Native dependency supply-chain | MOB-019 (CI / native-dep review) |
| 9 | One-maintainer kill-switch requirement | MOB-018 (observability) + MOB-021 (launch gate) |
| — | Write-path fail-closed (corrections) | MOB-016 (corrections) + MOB-010 (security) |

Whole-model sign-off (all threats closed with evidence) is a **MOB-021** adversarial launch
gate deliverable. This document is Proposed until that red-team review runs.
