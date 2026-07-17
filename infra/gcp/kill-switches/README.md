# Kill-switch infrastructure stubs (BB-035)

These files describe runtime controls only. **Nothing here has been applied to live GCP or Firebase.**

## Artifacts

- `kill-switch-matrix.json`: switch inventory, default behavior, and containment order.
- `runtime-flags.stub.json`: Remote Config and Firestore flag shape.
- `credential-revocation-matrix.json`: independently revocable identities and provider credentials.
- `queue-pause.stub.json`: Cloud Tasks pause-without-drop behavior.

## Runtime design

Server workloads read `killSwitches/{switchId}` from Firestore (ADR-011). Public clients may consume a mirrored Remote Config value for fast static-mode changes. If either source says a switch is engaged, engaged wins. Optional workload flags fail closed when missing, stale, malformed, or unavailable. The immutable public corpus remains available unless an operator explicitly enters static mode.

Every service must cache only briefly, subscribe or poll for updates, and emit a BB-018 audit event containing the operator, reason, incident id, old value, and new value. Do not expose operator identity or incident details in public responses.

## Human enablement (console or reviewed CLI)

1. In Firestore, create one `killSwitches/{id}` document per matrix entry using the shape in `runtime-flags.stub.json`. Restrict writes to the incident-operator role; service identities receive read-only access.
2. In Firebase Remote Config, create the matching public parameters. Set a short fetch interval appropriate for emergencies and use a server-side mirror to avoid client-only authority.
3. Start deferred features (`file-uploads`, `llm-calls`, research adapters) engaged until their owning beads authorize release.
4. Exercise one switch in staging, verify audit/telemetry, then document the observed propagation time.
5. Never paste secrets into Firestore, Remote Config, incident tickets, or this repository.

## Enter public static/read-only mode

1. Engage `public-static-mode` in Firestore and publish its Remote Config mirror.
2. Verify public pages resolve immutable snapshots from the currently active signed BB-019 release.
3. Verify corrections, search, location calls, uploads, exports, research, and publication are denied.
4. Keep CDN/App Hosting snapshot serving online. Static mode is containment, not an outage switch.

## Roll back the active release

1. Engage `publication` to prevent concurrent release activation.
2. Select the last verified signed immutable release and its paired search-index version.
3. Use the BB-019 operator path to atomically repoint `publicMeta/activeRelease`; never edit an active release in place.
4. Purge only affected CDN cache keys, verify manifest hashes, then keep publication disabled until incident review.

## Revoke one credential independently

1. Engage the matching workload switch.
2. Identify the exact service account, workload-identity binding, signing key, or provider key in `credential-revocation-matrix.json`.
3. Disable that credential or remove only its IAM binding. Do not disable unrelated principals.
4. Revoke sessions/tokens, inspect BB-018 and Cloud Audit Logs, issue a least-privilege replacement, and canary before re-enable.

## Pause queues without dropping work

For each affected queue, a human operator runs the reviewed equivalent of:

```bash
gcloud tasks queues pause QUEUE_ID \
  --location=us-central1 \
  --project=black-book-efaaf
```

Do **not** purge. Cloud Tasks retains existing tasks and accepts new tasks while dispatch is paused. Before resuming, inspect backlog age/depth and consumer idempotency, then resume one queue at reduced rate and watch dead-letter/error telemetry.

## Validation

```bash
pnpm --filter @black-book/config test
pnpm --filter @black-book/config typecheck
node --conditions development --import tsx --test packages/config/src/kill-switches.test.ts
```
