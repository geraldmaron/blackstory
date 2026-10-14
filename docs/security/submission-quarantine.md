# Submission quarantine

Corrections, contributions, and abuse reports enter a restricted submission quarantine. They never
write canonical entities, public projections, search indexes, or publication releases.

## Intake boundary

The submissions API accepts structured text plus source URLs only. Uploads, HTML payloads, arbitrary
fields, non-HTTPS URLs, URL credentials, and publication operations are outside this contract.

Requests pass through these controls in order:

1.  Client-version header format check. This spoofable signal provides no authentication or replay protection.
2.  correction endpoint quota and distributed-risk evaluation.
3.  schema, encoded-size, text-length, prohibited-character, source/link-count, and independent
   frequency validation.
4. Deterministic spam scoring and duplicate/coordinated-campaign assessment.
5. Append to submission quarantine with `canonicalWriteAllowed: false`.

`apps/api-submissions/src/quarantine.ts` requires the client-header check and quota decisions explicitly. It
also calls the  `write:quarantine` capability guard. A denied prerequisite or validation error
cannot append a record.

## State and data separation

`inboxState` describes boundary acceptance (`accepted` or a non-persisted `rejected` result).
`moderationState` is independent:

- `pending_review`
- `flagged`
- `duplicate`
- `coordinated_campaign`
- `blocked`
- `resolved`

No moderation state means “published” or authorizes promotion. Canonical writes remain the internal
publication surface's responsibility.

Each accepted record contains:

- an immutable, runtime-frozen copy of the exact parsed original and its SHA-256 integrity hash;
- a separate normalized form used for comparison and moderator workflows;
- spam score/signals and duplicate/campaign evidence;
- restricted privacy metadata and retention date;
- an append-only audit event containing the original hash.

Moderation transitions replace only the quarantine envelope. They retain the same frozen original
object and verify its content hash before transition.

## Privacy controls

Submitter contact is retained only in the restricted original. It is omitted from normalized content
and API intake responses; only a peppered digest indicates correlation. Subject and network values
must be opaque tokens produced at the trusted boundary, not raw IP addresses or account identifiers.
Records are marked `excludeFromTraining: true` and include an explicit retention deadline.

The production `privacyPepper` must come from the approved secret mechanism. Never commit it or log
the original/contact fields.

## Abuse operations

Duplicate detection uses normalized content fingerprints. Coordinated-campaign detection correlates
shared source sets across bounded actor/network dimensions and time windows. Moderator/admin tools
can transition records, block an opaque subject token, and submit abuse reports; reports use the same
quarantine path and cannot publish.

The web routes persist accepted leads, corrections, and abuse reports in `submissions.intake_items`
before returning 202. The staff Submissions desk reads that table. Promotion opens a research case;
rejection closes the public receipt with a coarse explanation. Staff may close a promoted correction
after verifying the resulting change. Every staff decision uses the admin pool and an audited
transaction. Public receipt responses never expose the staff reason or moderation signals.

The database synchronizes receipt lifecycle fields with intake decisions. A first eligible appeal
preserves its validated quarantine record, clears the previous closure, and requeues the original
correction. Compare-and-swap prevents lost updates. The public pool can update only the payload;
a guarded invoker trigger performs the requeue without granting public status-write permission.
Quick add and Attach evidence derive the actor from the verified staff session, require
`research:write`, and use the admin pool.

The separate `api-submissions` HTTP adapter still uses in-memory repositories and is not a durable
production intake service. Its mobile deployment path must be completed before accepting traffic.

## Validation

```bash
pnpm --filter @repo/security test
pnpm --filter @repo/security typecheck
pnpm --filter @repo/api-submissions test
pnpm --filter @repo/api-submissions typecheck
```
