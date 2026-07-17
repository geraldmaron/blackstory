# Unauthorized publication

## Trigger and triage

- Trigger on unexpected release activation, signer/audit mismatch, off-hours promotion, or public-content report.
- Record active/prior release ids, manifest hashes, search-index versions, actor, and first-seen time.

## Contain

1. Engage `publication` and `public-static-mode`.
2. Revoke the suspected publisher account, internal service identity, or signing key independently.
3. Atomically repoint the BB-019 active release and paired search index to the last verified release.
4. Purge only affected CDN keys and verify immutable snapshot hashes.

## Recover

- Audit every action from preview through activation and correct authorization/process gaps.
- Publish a new corrected release; never edit the unauthorized active release in place.
- Re-enable publication only after dual review and a staging canary.
