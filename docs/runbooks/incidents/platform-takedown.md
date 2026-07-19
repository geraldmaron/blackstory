# Platform takedown (false abuse reports)

**.** The attack this runbook defends against is non-technical: a coordinated actor files
mass false abuse reports (copyright, "harassment," "hate speech," phishing/malware) against
Google (Firebase Hosting/App Hosting, the GCP project, the Google Workspace/Cloud account) or the
domain registrar, aiming to trigger an *automated* suspension without ever touching our code or
infrastructure. Distinct from [`defacement.md`](./defacement.md) (content was actually changed)
and [`ddos-bot-flood.md`](./ddos-bot-flood.md) (technical volumetric pressure) — here the site and
data are intact but a third party is trying to get someone else to take it offline for us.

## Trigger and triage

- Trigger on: a suspension/restriction notice from Google Cloud/Firebase, the domain registrar, or
  GitHub; a spike in reports visible in the Google Cloud console Abuse/Trust & Safety area; or a
  registrar email about a WHOIS/abuse complaint.
- Triage: identify exactly which layer is threatened — hosting (Firebase/GCP project), DNS/domain
  (registrar), or repository (GitHub) — because the response and the human contact differ per
  layer. Confirm this is a false report, not a real policy violation, before proceeding (see
  "Evidence pack" below either way — you need it to prove either outcome).
- Registrar and host are already different vendors by design ( operator-protection runbook,
  "Registrar choice"): one false report to Google cannot also take the domain's DNS down, and vice
  versa. If that separation is not yet in place, treat closing it as the first follow-up action
  after this incident, not a blocker to responding now.

## Contacts

Fill in the real values as each is set up (tracked in
[`pre-launch-operator-protection.md`](../pre-launch-operator-protection.md)); keep this table
current so it is usable during an actual incident, not just at design time.

| Layer | Contact channel | Notes |
|---|---|---|
| Google Cloud / Firebase | Cloud Console → Support → new case (requires the paid support tier from the operator-protection runbook) | Free-tier billing accounts get community/self-help support only — no human to appeal to. This is why the paid tier is not optional for this scenario. |
| Domain registrar | Registrar's abuse/support contact (varies by registrar; record here once chosen) | Ask for the registrar's escalation path for a *contested* suspension, not just their abuse-report intake form. |
| GitHub | `support.github.com` (or GitHub Enterprise support if applicable) | Relevant only if a report targets the repository itself (e.g., a bogus DMCA claim against source code), not the live site. |
| Internal | Incident commander per [`incident-response.md`](../incident-response.md) operating model | Same roles (commander, ops lead, comms lead, scribe) as every other incident. |

## Evidence pack (proving the reports are false)

Assemble this *before* you need to file an appeal — most of it should already exist as a
byproduct of how the product is built, not something invented under pressure:

1. **Provenance and evidence chain.** Every published claim carries evidence links with a source
   classification and, per , a Wayback/Internet Archive capture pointer
   (`packages/domain/src/rights/evidence-pointer.ts`) rather than a rehosted copy — this is the
   single strongest artifact against a bogus copyright/scraping claim, since it shows the content
   is cited and linked out, not laundered.
2. **Audit trail export.** 's append-only audit events reconstruct exactly who
   published/corrected/retracted what and when (`packages/domain/src/audit/index.ts`,
   `packages/firebase/src/firestore/audit-outbox.ts` `loadEntityPublicationHistory`). Export the
   relevant entity's history to show a documented editorial process, not an anonymous dump.
3. **Constitution and threat-model posture.** `docs/security/threat-model.md`,
   `docs/security/abuse-cases.md`, and the product constitution
   (`packages/schemas/constitution/policy.v1.json`) demonstrate this is a moderated, policy-bound
   product with living-person protections (T-15) and a promotion gate (T-06/T-07), not an
   unmoderated dumping ground.
4. **Pre-incident content hash.** The  uptime/defacement canary
   (`.github/workflows/canary-uptime.yml`) records a sha256 of a canary page on a schedule; its
   last known-good hash (and, ideally, a full response snapshot taken at the same time) proves
   what the page actually said before any suspension, which rebuts a "the site currently shows
   X" claim if X was never true or was fixed before the report was filed.
5. **Report pattern itself.** Timestamps, source IPs/accounts if visible, and message templates
   across multiple reports — a burst of near-identical reports in a short window is itself
   evidence of a coordinated campaign rather than organic complaints (mirrors the T-05 brigading
   pattern already modeled for on-site abuse).
6. **Prior good standing.** Account age, absence of prior violations, and — once live — the
   uptime canary's clean history.

## Contain (Firebase-native backstop — primary)

The primary defense is availability under pressure, not fighting the false-report process itself:

1. If the threatened suspension is host-side (Firebase/GCP), do **not** wait for it — proactively
   engage `public-static-mode` (`packages/config/src/kill-switches.ts`,
   `evaluatePublicRuntimeMode`) so the signed immutable public corpus keeps serving read-only even
   if dynamic paths are pulled. This is the same switch and the same reasoning as every other
   incident in this runbook set; see `incident-response.md`'s containment order.
2. Engage `corrections-submissions` and `search` if the report specifically targets abuse of those
   surfaces (e.g., a "this site allows harassment via submissions" report) so the surface named in
   the complaint is demonstrably shut while the appeal is in flight.
3. If the domain/DNS layer is the one under threat and registrar ≠ host holds, the Firebase-hosted
   origin is unaffected by a registrar-level dispute — confirm this is actually true for the
   current registrar/host pair before relying on it.
4. Do not engage `publication` or make any content change in response to the report unless you
   have independently confirmed a real violation — changing content while an appeal is pending can
   look like an admission and complicates the evidence pack above.

## Recover

- Once the appeal channel (paid support case, registrar escalation, or GitHub support) confirms
  reinstatement or clears the report, disengage the switches used in Contain, verify public
  serving and the canary hash, and confirm no unrelated changes were introduced while switches
  were engaged.
- If data was actually affected at any point (not expected in a pure false-report scenario, but
  verify), use [`backup-restore.md`](../backup-restore.md) (Firestore PITR/managed export, )
  as the data backstop before assuming a clean bill of health.
- File a post-incident note per `incident-response.md`'s "Learn" step, including which layer was
  targeted, which contact channel actually resolved it, and how long resolution took — feed timing
  back into whether the paid support tier and registrar/host separation are working as intended.

## Optional hardening (not required to ship; apply only when triggered)

Per the  design note, do **not** set these up pre-emptively while nothing is live — apply
them only on an actual takedown/DDoS event, or immediately before a high-profile
launch/press moment:

- **Cloudflare free in front of the site**: separate blast radius for DNS from Google, free edge
  WAF/Bot Fight Mode, one rate-limit rule, and origin-IP hiding. Re-evaluate against the
  self-managed load balancer + Cloud Armor path at that point — Cloud Armor Standard has no free
  tier and needs a paid load-balancer floor, which is not worth it for a solo budget with nothing
  live yet.
- **Warm off-Google backup**: a periodic export to non-Google storage, so a Google-side event
  cannot simultaneously threaten both serving and the only copy of the data. 's PITR/export
  already protects against data loss; this is specifically about *vendor* diversity for the
  backup, not about backup existing at all.

## References

- [`pre-launch-operator-protection.md`](../pre-launch-operator-protection.md) — registrar/host
  separation, paid support tier signup, and the rest of the  checklist
- [`incident-response.md`](../incident-response.md) — operating model and kill-switch containment
  order this runbook reuses
- [`backup-restore.md`](../backup-restore.md) —  PITR/backup data backstop
- `packages/config/src/kill-switches.ts` — /035 kill switches and degraded snapshot mode
  (`evaluatePublicRuntimeMode`, `containmentOrder`)
- `packages/domain/src/rights/evidence-pointer.ts` —  Wayback-pointer/minimal-snippet
  posture used as fair-use evidence
- `packages/domain/src/audit/index.ts`,
  `packages/firebase/src/firestore/audit-outbox.ts` —  audit trail export
- `.github/workflows/canary-uptime.yml` —  uptime/defacement canary
