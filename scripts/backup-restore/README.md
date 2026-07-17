# Backup and restore scripts (BB-020)

Non-interactive verification helpers for Firestore export metadata and BB-019 release manifests.
**Dry-run by default** — no `gcloud`, no production secrets.

## Commands

```bash
# Unit tests
node --test scripts/backup-restore/verify-restore.test.mjs

# Verify export metadata sidecar (fixtures)
node scripts/backup-restore/verify-restore.mjs \
  --metadata scripts/backup-restore/fixtures/sample-export-metadata.json \
  --baseline-counts scripts/backup-restore/fixtures/sample-baseline-counts.json \
  --baseline-hashes scripts/backup-restore/fixtures/sample-baseline-hashes.json \
  --active-pointer scripts/backup-restore/fixtures/sample-active-pointer.json \
  --release scripts/backup-restore/fixtures/sample-release.json

# IAM matrix dry-run
node scripts/backup-restore/verify-iam-matrix.mjs

# Staging import command stub (print only)
bash scripts/backup-restore/staging-restore.stub.sh
```

## Checks

| Helper | Validates |
|--------|-----------|
| `compareDocumentCounts` | Per-collection doc counts vs baseline |
| `compareCollectionHashes` | Per-collection sha256 content hashes |
| `verifyManifestEnvelope` | BB-019 manifest structure + `manifestHash` digest |
| `verifyActiveReleasePointer` | `publicMeta/activeRelease` matches active release |
| `verifyExportMetadata` | Full sidecar JSON from post-export hook |
| `verifyIamMatrixDesign` | Retention matrix + runtime SA deny list |

## Related docs

- [`infra/firebase/backup/`](../../infra/firebase/backup/)
- [`docs/runbooks/backup-restore.md`](../../docs/runbooks/backup-restore.md)
