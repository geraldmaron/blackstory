# Dependency compromise

## Trigger and triage

- Trigger on advisory, malicious package/action, lockfile drift, provenance failure, or unexpected build/runtime behavior.
- Identify versions, build/deploy runs, artifacts, credentials exposed to the dependency, and first inclusion.

## Contain

1. Stop affected CI/deploy workflows and engage publication plus feature switches for exposed paths.
2. Enter static mode if runtime integrity is uncertain; retain the last verified immutable corpus.
3. Revoke OIDC/provider/deploy credentials reachable by the compromised dependency.
4. Preserve lockfiles, artifacts, SBOM/provenance, workflow logs, and package bytes.

## Recover

- Pin/remove the dependency, rebuild from a clean trusted environment, and compare provenance.
- Redeploy the last known-good artifact or corrected build; use  rollback for public data releases.
- Run security/regression suites and canary before restoring workflows or optional features.
