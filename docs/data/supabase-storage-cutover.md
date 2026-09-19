# Storage contract

Supabase Storage holds public media in `public-media` and access-controlled source captures in
`raw-sources`. Upload references and public URLs must refer to the same bucket and object key.
Public image helpers live in `packages/ops-data/src/records/entity-media.ts`; delivery URL helpers
live in `packages/domain`.

A source citation does not imply permission to mirror its bytes. Record source URL, retrieval time,
content digest, rights basis, and capture outcome separately. Restricted captures must not receive
public URLs. A failed fetch, metadata-only record, or archive request is not a preserved capture.

Large datasets may remain citations to the publisher's hosted artifact when mirroring is unnecessary
or exceeds the storage budget. The Opportunity Atlas source is intentionally cited at its publisher;
its selected derived observations live in Postgres. Do not restore a GCS dependency to mirror it.

There is no dual-write or automatic fallback to GCS. Existing cloud resources and old URLs require
an inventory before account-level deletion; repository cleanup alone does not establish that all
remote resources have been removed. See [retirement boundary](firebase-wind-down.md).
