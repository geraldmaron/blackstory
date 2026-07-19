# Incident response and kill switches

## Operating model

1. **Declare:** Open an incident, assign commander, operations lead, communications lead, and scribe. Use UTC.
2. **Contain:** Stop optional and high-volume workloads first. Preserve immutable public serving when safe.
3. **Eradicate:** Revoke only affected credentials, quarantine tainted data/artifacts, and patch the cause.
4. **Recover:** Canary one dependency at a time, validate audit and security telemetry, then restore capacity.
5. **Learn:** Preserve evidence, publish a blameless timeline, and add regression tests.

Do not place secrets, sensitive personal data, raw malicious payloads, or access tokens in incident tickets. For criminal activity or a privacy event, preserve chain of custody and involve legal/privacy leadership.

## Control map

- Runtime switches: `packages/config/src/kill-switches.ts`
- Human GCP/Firebase steps: `infra/gcp/kill-switches/README.md`
- Release rollback:  immutable release pointer and paired search-index version
- Canonical recovery: [`backup-restore.md`](./backup-restore.md) only when release rollback is insufficient
- Audit trail:  audit/outbox

Engage switches in this order unless evidence requires faster isolation: research campaigns, LLM, geocoding/nearby, uploads/exports, affected adapters, submissions/search, queues, publication, then public static mode. Static mode keeps the signed immutable public corpus online while all mutations and dynamic features stop.

## Scenario runbooks

- [DDoS or bot flood](./incidents/ddos-bot-flood.md)
- [Account compromise](./incidents/account-compromise.md)
- [Secret leak](./incidents/secret-leak.md)
- [Data poisoning](./incidents/data-poisoning.md)
- [Unauthorized publication](./incidents/unauthorized-publication.md)
- [Defacement](./incidents/defacement.md)
- [Database compromise](./incidents/database-compromise.md)
- [Cloud bill spike](./incidents/cloud-bill-spike.md)
- [Malicious source](./incidents/malicious-source.md)
- [Privacy incident](./incidents/privacy-incident.md)
- [Dependency compromise](./incidents/dependency-compromise.md)

## Tabletop exercise

**Goal:** Demonstrate every  acceptance criterion in staging or a no-cloud simulation. No production mutation is required.

**Participants:** incident commander, platform operator, security lead, publication operator, support/comms, observer.
**Evidence:** timestamped incident log, screenshots or sanitized command output, switch decisions, release ids/hashes, queue counts, credential id (never secret value).

### Injects and expected outcomes

1. **00:00 — Bot flood plus anomalous model spend.** Operator engages research, LLM, geocoding, affected adapter, submissions, and search controls in containment order.
   **Pass:** optional and volume workloads deny before public serving; immutable entity snapshots still return.
2. **00:10 — Dynamic API is considered unsafe.** Operator engages `public-static-mode` without a deployment.
   **Pass:** mode reports read-only, dynamic writes/search/location deny, and the signed active release snapshots remain readable.
3. **00:20 — Latest release contains an unauthorized page.** Operator engages publication and performs the  atomic active-pointer rollback with the prior search-index version.
   **Pass:** prior signed release becomes active immediately; no rebuild or canonical mutation occurs.
4. **00:30 — `api-internal` credential suspected stolen.** Operator removes only that identity/binding and preserves public/web identities.
   **Pass:** internal publication access fails; unrelated public snapshot access remains healthy.
5. **00:40 — Poisoned tasks are dispatching.** Operator pauses the affected Cloud Tasks queue without purge, records depth/oldest age, and enqueues a synthetic task.
   **Pass:** dispatch stops, existing and newly accepted tasks remain, and canary resume processes each once.
6. **00:55 — Recovery.** Team verifies manifest hashes, audit events, alarms, and switch propagation; restores one dependency at a time.
   **Pass:** no switch re-enable occurs without owner approval and observable canary results.

### Exit criteria

- All five acceptance outcomes pass with evidence.
- Every participant can locate the switch matrix and relevant scenario runbook.
- Propagation time and rollback time are recorded.
- Gaps receive tracked beads with owner and severity; failed criteria require a repeat exercise.
