# Runbook: Pre-launch operator protection (BB-089)

**Scope:** Human-executed OPSEC, account-hardening, legal, and impersonation-defense steps that
must happen before the repository/site goes public and before BB-063 (beta launch) proceeds.
**Not executed by BB-089 or by this document.** No domain was registered, no account was created,
no 2FA setting was changed, no payment was made, and no DMCA agent was registered by the session
that wrote this runbook — every action below is a checklist item for the human operator to
execute in one sitting, the same convention this project already uses for cloud/account actions
(see [`production-environment-resplit-migration.md`](./production-environment-resplit-migration.md)
for the pattern). This is that same pattern applied to non-cloud, real-world operator actions.

**Why this exists:** a solo-run, deliberately controversial historical archive will face
coordinated *non-technical* attack before it faces a technical one — operator de-anonymization,
platform takedown via false abuse reports, root-account takeover, and brand impersonation. The
existing [threat model](../security/threat-model.md) (BB-004) is strong on technical integrity;
this runbook closes the operator/platform/impersonation/legal delta the 2026-07-17 adversarial
review found, without duplicating BB-004. The public-facing half of "protection" (rigor, trust
signaling, pre-bunking) is BB-088 — this document is internal only and none of it becomes
defensive public copy.

**Blocks:** BB-063 (beta launch). Several items below are one-way doors (domain registration, git
history going public, LLC-as-WHOIS-registrant) that are cheap now and painful or impossible to
retrofit after launch — that is why this is pre-launch, not "eventually."

**Launch-gate note:** independent of the items below, BB-089's design also calls for community
submissions to launch **gated**, with the graylist/review queue never obligated to be drained on
day one — a solo operator cannot staff BB-076's consensus-of-N review or a flooded queue at
launch. That is a BB-063 launch-gate condition and a BB-076 acceptance note, not something this
runbook's checklist executes; flagged here so it is not lost.

## How to use this checklist

Each item states the **action**, **why**, and a **verification** step. Work top to bottom within
a section; sections are ordered roughly by how painful they are to fix later (OPSEC and root
2FA first, perimeter hygiene last). Nothing here requires a paid tier except where marked **(paid)**.

---

## 1. Operator OPSEC / de-identification

One-way doors: domain registration and the repository's first public commit. Do these before
anything else.

- [ ] **Choose a non-`.us` domain (`.org`/`.com`), not `.us`.** Verified: `.us` WHOIS records
  forcibly publish the registrant's actual name and address with no privacy option — this is a
  registry policy (`usTLD`/Registry.US Nexus and WHOIS requirements), not a registrar setting, so
  no registrar can work around it. Use `.org` or `.com` instead.
  **Verify:** query WHOIS for the candidate domain post-registration and confirm registrant
  contact shows the registrar's privacy-proxy details, not a real name/address.
- [ ] **Pick a registrar that is (a) not the same vendor as hosting and (b) offers free WHOIS
  privacy.** Hosting is Google/Firebase (owner directive: "everything will be in Firebase for
  now"), so the registrar must be an independent vendor — this is also what
  [`platform-takedown.md`](./incidents/platform-takedown.md) relies on ("registrar ≠ host") so a
  false report to one vendor cannot take down DNS and hosting together. Any mainstream registrar
  with included WHOIS privacy at no extra cost satisfies this (confirm current pricing/features at
  purchase time — do not assume a specific vendor's offering is unchanged from when this was
  written).
  **Verify:** registrar account is a different organization/login than the Google Cloud/Firebase
  billing account; WHOIS privacy is confirmed enabled, not merely "available."
- [ ] **Register under an organization/registered-agent address, not a home address.** Once the
  LLC (Section 5) exists, use its registered-agent address as the domain registrant address. Until
  then, do not register the domain with a home address as a stopgap — wait for the LLC, or use the
  registrar's privacy-proxy address exclusively in the interim.
  **Verify:** WHOIS registrant organization/address matches the LLC's registered agent, never a
  personal address.
- [ ] **Set a pseudonymous git author name + a noreply/role email, before the repository goes
  public.** Rewriting authorship history after the repo is public is disruptive (force-push,
  contributor confusion, cached forks/mirrors keep the old data) — do this while the repo is still
  private.
  1. Decide the pseudonym/handle that will be the public-facing project identity.
  2. Set it going forward: `git config user.name "<pseudonym>"` and
     `git config user.email "<id>+<pseudonym>@users.noreply.github.com"` (GitHub's own noreply
     address format) or a role alias at the eventual domain (`maintainers@<domain>`), scoped to
     this repo (`git config` without `--global`) so it does not leak into unrelated repos.
  3. **Check existing history before going public:** `git log --format='%an <%ae>' | sort -u` —
     if any real name/email already appears in committed history, decide now (while private)
     whether to rewrite it (`git filter-repo`, reviewed and tested on a clone first) or accept the
     exposure. Do not defer this decision past the repo going public.
  **Verify:** `git log -1 --format='%an <%ae>'` shows only the pseudonym/role identity; a full
  history scan (step 3) has been run and its result recorded (clean, or rewritten, or
  knowingly-accepted).
- [ ] **Replace the personal security contact with a role address and `/.well-known/security.txt`.**
  The code side of this is already built — `apps/web/src/app/.well-known/security.txt/route.ts`
  serves an RFC 9116 file, but every value in it is a placeholder
  (`security@blackbook.example`) until a real domain and mailbox exist.
  1. Once the domain is registered, create a `security@<domain>` mailbox (an alias forwarding to
     the operator's real inbox is sufficient — it does not need to be a distinct mail account).
  2. Update `PLACEHOLDER_DOMAIN` in `apps/web/src/app/.well-known/security.txt/route.ts` to the
     real domain (a follow-up code change, not this runbook).
  **Verify:** `GET https://<real-domain>/.well-known/security.txt` returns a `Contact:` line with
  the real role mailbox, not `blackbook.example`.

## 2. Root-account hardening (free; blocks the worst case)

Extends BB-027 (which is app-layer admin MFA — Firebase Auth + IAP + RBAC for the admin console —
not root/console-account security; see `docs/security/admin-identity.md`). This section is about
the human accounts that hold the keys to GitHub and Google Cloud/Firebase themselves.

- [ ] **Buy two hardware security keys (FIDO2/WebAuthn), e.g. two YubiKeys** — one primary, one
  backup stored in a separate physical location. Two keys, not one: a lost single key otherwise
  forces a fallback to a weaker recovery method at the worst possible time.
- [ ] **Enroll both keys on GitHub.** GitHub → Settings → Password and authentication → Two-factor
  authentication → Security keys → add both. Then remove SMS-based 2FA if it was ever enabled
  (SIM-swap is a known real-world account-takeover vector; a hardware key removes the incentive to
  fall back to SMS at all). Download the account recovery codes.
- [ ] **Enroll both keys on the Google account used for Firebase/Google Cloud.** Google Account →
  Security → 2-Step Verification → Security keys → add both; set a passkey/security key as the
  primary method. Remove SMS/text-message 2-Step Verification once the keys are confirmed working
  (test sign-in with a key before removing SMS, so there is no lockout window). Download/print the
  backup codes.
- [ ] **Store both sets of recovery/backup codes offline** — printed and kept somewhere physically
  secure (not in the same password manager vault as the accounts they recover, and not in this
  repository or any cloud note tied to the same identity).
- [ ] **Enable "require two-factor authentication" at the GitHub organization level**, if/when the
  project repository moves under a GitHub organization rather than a personal account. Org-level
  enforcement means any future collaborator is also forced through hardware-key 2FA, not just the
  owner.
- [ ] **Separate the billing-owner identity from the day-to-day deploy identity.** The
  machine/service-account side of this is already covered — no service account ever holds an
  exported key (`infra/gcp/wif/deploy-roles.md`, `infra/gcp/service-accounts.matrix.md`: "no
  exported keys" is a hard must-not-have) and GitHub Actions authenticates via Workload Identity
  Federation, not a stored credential. This item is the *human* side: the Google account that owns
  billing/can raise budgets should not be the same account habitually used for day-to-day console
  clicking and CI approvals, so a single phished session cannot both deploy something and also max
  the bill. If a single Google account is unavoidable at solo-operator scale, at minimum keep
  billing alerts/budget-owner notifications going to a channel the operator checks daily.
  **Verify:** confirm which Google account is the Cloud Billing Account owner/administrator versus
  which account(s) hold day-to-day IAM roles used for deploys; record the answer here once decided.

Add this section's completion status to the BB-079 human-apply checklist tracking production
cloud setup, since both share the "one sitting, human-only" execution model.

## 3. Platform-takedown resilience

The Firebase-native availability backstop is **primary** and is already built — this section adds
the process/contract pieces around it, not a replacement for it.

- [ ] **Confirm registrar ≠ host** (see Section 1) — this alone means one vendor's false-report
  process cannot simultaneously take down DNS and hosting.
- [ ] **Subscribe to a paid Google Cloud support tier (e.g. Standard) (paid, ~$29/month at time of
  writing — confirm current pricing before purchasing).** Free-tier billing accounts get
  community/self-help support only; there is no human to appeal to during a suspension without a
  paid tier. This is the one recurring paid line item in this runbook, and it exists specifically
  so [`platform-takedown.md`](./incidents/platform-takedown.md) has a real appeal channel.
  **Verify:** Cloud Console → Support shows an active paid support case type, and a test/low-
  priority case can actually be filed.
- [ ] **Read [`platform-takedown.md`](./incidents/platform-takedown.md)** — the incident runbook
  this bead ships, covering contacts, the evidence pack, and containment steps referencing the
  real BB-033/035 kill switches (`packages/config/src/kill-switches.ts`,
  `evaluatePublicRuntimeMode`, `containmentOrder`) and BB-020's PITR/backup
  (`docs/runbooks/backup-restore.md`) as the data backstop. Nothing to execute here beyond reading
  it and filling in the contacts table once the registrar/support case exist.
- [ ] **(Optional, triggered only)** Cloudflare free in front of the site and a warm off-Google
  backup — see "Optional hardening" in `platform-takedown.md`. Do not set these up while nothing
  is live; apply only after an actual takedown/DDoS event or immediately before a high-profile
  launch/press moment, per the BB-089 design note.

## 4. Brand-impersonation early-warning

Squatters move at announcement — this section must be live **before** any public announcement, not
after.

- [ ] **Set up free certificate-transparency monitoring before announcement.** Use
  [crt.sh](https://crt.sh) (searchable, has an email/RSS-style watch pattern via third-party
  wrappers) and/or [CertSpotter](https://sslmate.com/certspotter/) (SSLMate; free tier includes
  email alerts for a monitored domain list) against a curated list of typo/lookalike variants of
  the real domain (common misspellings, hyphenation, TLD swaps, homoglyphs). Build this list once
  the real domain is chosen and keep it in whatever private notes/password-manager-adjacent
  location the operator already uses for OPSEC material — not in this public repository.
  **Verify:** a test alert fires (e.g., manually search crt.sh for a known-issued cert on the real
  domain to confirm the monitoring query actually returns results) before relying on it.
- [ ] **Defensively register the highest-risk domain variants** from the same list, at or before
  announcement — do not wait for evidence of squatting. Prioritize the obvious TLD siblings of the
  chosen domain and the one or two most likely misspellings; defensive registration budget is
  finite, so do not attempt to own every conceivable variant.
- [ ] **Reserve the brand's social handles at launch** (matching the primary domain name) on
  whichever platforms are relevant to the audience this project expects to reach — reserve the
  handle even on platforms not actively used yet, specifically to deny it to an impersonator.
- [ ] **Build the official-properties page** — pattern documented in
  [`docs/ui/official-properties.md`](../ui/official-properties.md). The real accounts do not exist
  yet, so this is a pattern/stub only for now; fill in real `sameAs` URLs once the handles above
  are actually reserved.
- [ ] **Write a lookalike/DMCA-clone takedown playbook** once a real domain exists, using the same
  DMCA agent registration and counter-notice machinery from Section 5 — a clone site is the
  mirror-image case (someone else infringing *our* content) rather than the case Section 5's
  counter-notice process defends against (someone claiming *we* infringed *theirs*). Draft this as
  a follow-up once the domain and DMCA agent registration are real; the process is: identify host
  via WHOIS/hosting-provider lookup → file a DMCA takedown with that host citing the original
  publication's Wayback-captured evidence trail (`packages/domain/src/rights/evidence-pointer.ts`)
  as proof of priority → escalate to the registrar if the host is unresponsive.

## 5. Legal shielding

Low urgency relative to Sections 1–2, high impact, and cheap. Do this before the domain
registration in Section 1 if sequencing allows, since the LLC becomes the WHOIS registrant.

- [ ] **Form an LLC to hold the project.** Two independent reasons this matters: (1) asset/liability
  shield between the project and the operator's personal assets, and (2) it becomes the WHOIS
  registrant and domain-registration entity, which is real OPSEC value on top of the legal value
  (Section 1). Use a standard state LLC formation service or a lawyer, per the operator's
  jurisdiction and budget; this runbook does not pick a state or filer for the operator.
  **Verify:** LLC formation documents filed and accepted by the state; an EIN obtained; a
  registered agent address on file (this address is what Section 1's domain registration uses).
- [ ] **Know the applicable state anti-SLAPP statute before launch, not after a threat letter
  arrives.** Anti-SLAPP statutes let a defendant get a meritless defamation/harassment suit aimed
  at chilling speech dismissed early and often recover attorney's fees — highly relevant for a
  project publishing researched claims about real people and institutions. Identify which state's
  law applies (LLC's state of formation, the operator's residence, and/or where the alleged harm
  occurred can each matter depending on the claim) and read a plain-language summary before
  launch. This runbook does not substitute for counsel — treat this as "know enough to recognize
  when to invoke it and call a lawyer," not as legal advice.
- [ ] **Register a DMCA safe-harbor agent with the U.S. Copyright Office ($6, valid 3 years).**
  1. Go to the Copyright Office's Designated Agent Directory (`dmca.copyright.gov`) and register.
  2. Designate the role security/legal contact (Section 1's role mailbox, not a personal one) as
     the agent contact.
  3. Pay the $6 fee; note the 3-year renewal date somewhere durable (fold into the recurring
     maintenance this bead already documents as belonging to BB-084 — CT monitors, uptime canary,
     link-health, DMARC reports, and now this renewal date).
  4. This registration is a prerequisite for DMCA §512(c) safe-harbor protection for user-generated
     content (correction submissions, future community contributions) — without a registered
     agent, a copyright claim about UGC cannot benefit from the safe harbor regardless of how the
     content was actually handled.
  **Verify:** the agent listing is live and searchable in the Copyright Office directory; the
  contact email actually receives mail (send a test message).
- [ ] **Write a takedown/counter-notice runbook wired to BB-077.** When a copyright claim comes in
  against something Blap published (as opposed to Section 4's mirror case), the process is:
  1. Log the claim as a `copyright_claim`-reasoned takedown request — the data model for this
     already exists (`packages/domain/src/rights/takedown.ts`, `TAKEDOWN_REASONS`,
     `TAKEDOWN_DISTINCT_TAG`), pending the public-facing intake UI (BB-055/BB-076, not built yet).
  2. Evaluate whether the claim has merit against BB-077's actual posture: every evidence pointer
     carries a mandatory Wayback/Internet Archive capture link and a snippet capped to roughly one
     or two sentences (`packages/domain/src/rights/evidence-pointer.ts`) rather than a rehosted
     copy of the source. This link-out-plus-minimal-snippet posture is the fair-use basis for a
     counter-notice: Blap is not republishing the work, it is citing and linking to an
     archival capture of it.
  3. If the claim is meritless, file a formal DMCA counter-notice citing that posture, through
     whichever host received the original takedown notice (Google/Firebase, GitHub, etc.).
  4. If the claim has merit (e.g., a snippet genuinely exceeds fair-use scope), retract/correct the
     specific claim using the existing retraction machinery
     (`retraction.retracted` / `retraction.reversed` audit actions,
     `packages/domain/src/audit/index.ts`) rather than contesting it.
  **Verify:** this section has been read and understood by whoever will handle a real claim; no
  code action required beyond what BB-077 already built.

## 6. Perimeter hygiene

Free, set-and-forget, or folds into BB-084's scheduler. Most of this section is already built —
this is a checklist of what exists plus the remaining DNS record changes only the domain owner can
make.

- [ ] **AI-scraper directives — already built.** `apps/web/src/app/robots.ts` (standard
  `robots.txt` convention, Next.js App Router) and `apps/web/src/app/ai.txt/route.ts` (the
  `/ai.txt` convention some AI crawlers check independently) both disallow a curated list of
  AI-training/bulk-scraping user agents while allowing normal search-engine indexing. The list
  lives once, in `AI_TRAINING_USER_AGENTS` in `robots.ts`, and `ai.txt` imports it — the two files
  cannot drift apart. Both are courtesy signals honored only by crawlers that choose to; they are
  not access control (see `docs/security/threat-model.md` T-19 for the real controls: rate limits,
  App Check, cache-busting normalization). Review `AI_TRAINING_USER_AGENTS` periodically as new
  agents appear — fold that review into BB-084's scheduled maintenance.
  **Verify:** `GET /robots.txt` and `GET /ai.txt` on the deployed site both return the expected
  disallow lists (confirmed locally via `next build && next start` during this bead's
  implementation).
- [ ] **Map-tile/static-asset scraping caps** (BB-070 tiles are not App-Check-eligible) — **not**
  built by this bead; this is a documented forward reference, not a checklist item with a human
  action. The intended mechanism is long-TTL immutable caching plus Referer/Origin checks at the
  tile-serving layer, tracked against BB-070's own scope. File or locate the BB-070 follow-up bead
  before BB-063 launch if tile scraping becomes a measured problem.
- [ ] **Uptime/defacement canary — already built as code, not yet live.**
  `.github/workflows/canary-uptime.yml` fetches a canary URL, hashes the response, and fails the
  run (GitHub notifies watchers on scheduled-workflow failures by default) on a non-200 status or
  a hash change versus the last known-good baseline (persisted via `actions/cache`, not a committed
  file, since no production URL exists yet). Its `schedule:` trigger is intentionally commented
  out so it does not fail every 30 minutes against nothing.
  1. Once a production canary URL exists, uncomment the `schedule:` block in
     `canary-uptime.yml` and set `cron` to the desired interval.
  2. After a confirmed legitimate deploy that changes the canary page's content, re-run the
     workflow manually (`workflow_dispatch`) with `reset_baseline: true` so the new content becomes
     the accepted baseline instead of triggering a false alarm on the next scheduled run.
  **Verify:** a manual `workflow_dispatch` run against a real URL succeeds and a cache entry named
  `canary-hash-<url>-<run_id>` appears in the repository's Actions cache list.
- [ ] **DMARC `p=reject` + SPF + DKIM — DNS records only the domain owner can create.** Add these
  once the domain is registered (Section 1); exact values depend on which provider actually sends
  mail for the domain (Google Workspace, a transactional-email provider, or none at all), so treat
  the examples below as a format template, not literal values to paste:
  - **SPF** (TXT record at the apex, e.g. `<domain>`):
    `v=spf1 include:_spf.google.com ~all` if using Google Workspace to send mail, or
    `v=spf1 -all` if the domain never sends mail at all (safest default until a real mail
    provider is chosen — an explicit "nothing may send as this domain" record still helps
    anti-spoofing).
  - **DKIM** (TXT record at a provider-specific selector, e.g.
    `google._domainkey.<domain>`): generated by whichever mail provider is used (Google Workspace
    admin console → Apps → Gmail → Authenticate email, for example) — there is no generic value to
    template here; follow the provider's setup flow and it will give you the exact record.
  - **DMARC** (TXT record at `_dmarc.<domain>`):
    `v=DMARC1; p=reject; rua=mailto:dmarc-reports@<domain>; ruf=mailto:dmarc-reports@<domain>; fo=1`
    — start at `p=quarantine` for an initial monitoring period if there is any uncertainty about
    SPF/DKIM coverage, then move to `p=reject` once DMARC aggregate reports (`rua`) confirm no
    legitimate mail is failing alignment. `p=reject` is the end state this bead's acceptance
    criteria call for; `p=quarantine` is an acceptable temporary step, not the final state.
  **Verify:** `dig TXT <domain>` / `dig TXT _dmarc.<domain>` show the published records;
  a DMARC report ("rua") arrives within a few days and shows `pass` for legitimate mail and the
  intended `reject` disposition for anything that fails alignment.
- [ ] **Pseudonymous reviewer model — already true, verified, not built.** BB-018's audit trail
  (`packages/domain/src/audit/index.ts`) records reviewer identity as an `AuditActor` with only
  `id`, `type` (`user` / `service` / `system`), and an optional `displayName` — there is no email,
  real-name, or contact field on the audit event or on `PublicationHistoryEntry`. No code currently
  wires `loadEntityPublicationHistory` (`packages/firebase/src/firestore/audit-outbox.ts`) into any
  public-facing page (confirmed by search: no `apps/web` usage of publication history exists yet).
  As long as (a) `AuditActor.id`/`displayName` are populated with a pseudonym or opaque id rather
  than a reviewer's real name when reviewer accounts are created, and (b) any future public history
  UI (BB-055/BB-076 territory) continues to omit or pseudonymize `actor`, this invariant holds
  without new code. Flag this as an explicit acceptance check on whichever bead first builds a
  public-facing history/audit view.

## Verification summary

| Section | Definition of done |
|---|---|
| 1. OPSEC | Domain is `.org`/`.com` with WHOIS privacy at a non-hosting registrar, registrant is the LLC, git identity is pseudonymous with history checked, security.txt points at a real role mailbox |
| 2. Root hardening | Two hardware keys enrolled on GitHub and Google, SMS 2FA removed from both, recovery codes stored offline, org 2FA required (once an org exists), billing/deploy identity separation recorded |
| 3. Platform-takedown | Registrar ≠ host confirmed, paid Google Cloud support tier active, `platform-takedown.md` contacts table filled in |
| 4. Impersonation | CT monitoring live and test-fired, domain variants registered, social handles reserved, official-properties page has real `sameAs` links |
| 5. Legal | LLC formed with EIN and registered agent, anti-SLAPP statute identified, DMCA agent registered and live in the Copyright Office directory |
| 6. Perimeter hygiene | `robots.txt`/`ai.txt` verified live, canary schedule uncommented against a real URL, DMARC at `p=reject` with clean aggregate reports, pseudonymous-reviewer invariant re-checked against any new public history UI |

All items above must be checked before BB-063 (beta launch) proceeds.

## References

- [`incidents/platform-takedown.md`](./incidents/platform-takedown.md)
- [`production-environment-resplit-migration.md`](./production-environment-resplit-migration.md) — the runbook-format precedent this document follows
- [`backup-restore.md`](./backup-restore.md) — BB-020 data backstop
- [`incident-response.md`](./incident-response.md) — kill switches and containment order
- [`../security/threat-model.md`](../security/threat-model.md), [`../security/abuse-cases.md`](../security/abuse-cases.md) — BB-004 technical threat model this bead does not duplicate
- [`../ui/official-properties.md`](../ui/official-properties.md) — verified-accounts page pattern
- `apps/web/src/app/robots.ts`, `apps/web/src/app/ai.txt/route.ts`, `apps/web/src/app/.well-known/security.txt/route.ts`
- `.github/workflows/canary-uptime.yml`
- `packages/config/src/kill-switches.ts` — BB-033/035
- `packages/domain/src/rights/evidence-pointer.ts`, `packages/domain/src/rights/takedown.ts` — BB-077
- `packages/domain/src/audit/index.ts` — BB-018
