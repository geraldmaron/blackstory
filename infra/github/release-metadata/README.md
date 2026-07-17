# Deployment provenance / release metadata (BB-010 stub for BB-062).
# Schema for artifacts written when a production deploy job obtains WIF credentials.

Every production deploy must emit a provenance document that records **who/what** deployed
(commit, workflow, run, environment, federated principal) without storing secrets.

## Files

| Path | Role |
|------|------|
| `deployment-provenance.schema.json` | JSON Schema (Draft 2020-12) |
| `example.deployment-provenance.json` | Example stub (synthetic IDs) |

## Producer (BB-062)

`.github/workflows/deploy-production.yml` writes a stub artifact today. BB-062 should:

1. Validate the JSON against this schema before upload.
2. Attach the artifact to the GitHub Actions run.
3. Persist an immutable copy beside release pointers / publication metadata.

## Non-goals

- Not a substitute for Sigstore/SLSA attestation (may be added later).
- Does not grant deploy authority; WIF trust conditions do.
