# Defacement

## Trigger and triage

- Trigger on visual/content drift, hash mismatch, unexpected host artifact, or public report.
- Determine whether the active release, deployment artifact, DNS/CDN, or client-side dependency changed.

## Contain

1. Engage `publication` and `public-static-mode`.
2. If release content changed, execute BB-019 rollback; if host code changed, use the last known-good deployment artifact.
3. Revoke only the compromised deployer, publisher, DNS, or CDN credential.
4. Preserve artifacts, manifests, headers, and audit logs before cache changes.

## Recover

- Verify release signatures, CSP/assets, DNS/TLS, and clean build provenance.
- Purge affected caches, canary from multiple networks, and monitor hash drift.
- Keep mutation controls engaged until the compromise path is closed.
