# Deployment provenance / release metadata (BB-010 schema; BB-062 producers).

Every production deploy must emit a provenance document that records **who/what** deployed
(commit, workflow, run, environment, federated principal) without storing secrets.

## Files

| Path | Role |
|------|------|
| `deployment-provenance.schema.json` | JSON Schema (Draft 2020-12) |
| `example.deployment-provenance.json` | Example stub (synthetic IDs) |

## Producers (BB-062)

| Producer | Role |
|----------|------|
| `infra/github/release-pipeline/write-provenance.mjs` | Build provenance JSON for staging/production |
| `infra/github/release-pipeline/validate-provenance.mjs` | Validate against this schema |
| `.github/workflows/deploy-staging.yml` | Emits staging provenance artifact |
| `.github/workflows/deploy-production.yml` | Emits production provenance + changelog |
| `.github/workflows/progressive-release.yml` | Pre-promote provenance/changelog for a pinned SHA |

Operator runbook: `docs/runbooks/production-release.md`.

## Non-goals

- Not a substitute for Sigstore/SLSA attestation (may be added later).
- Does not grant deploy authority; WIF trust conditions do.
