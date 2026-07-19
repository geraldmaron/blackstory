# Security gates

BB-036 defines repository security checks and production promotion invariants. The
checked-in policy is authoritative; GitHub Advanced Security settings are not claimed
as active until an administrator verifies them.

## Fail-closed policy

- Critical and high CodeQL, dependency, secret, filesystem, container, DAST, and
  infrastructure-policy findings block production.
- A scanner error is a failed check, not a warning.
- Suppressions live only in `suppressions.json`. Each entry must satisfy
  `suppression.schema.json` and include a reason, accountable `team/handle`, and future
  expiration. Expired suppressions fail validation.
- Security outputs are retained for 90 days in Actions and attached to the corresponding
  release record before production promotion.
- Production records the exact 40-character tested commit and immutable
  `sha256:<64 hex>` image digest. Cosign verification must bind that digest to the
  GitHub Actions OIDC issuer and the protected release workflow identity.

## Human GitHub setup

After the repository exists and an administrator has authenticated with `gh`:

1. Enable GitHub Code Security/Advanced Security if the repository plan requires it.
2. Enable code scanning, dependency graph, dependency review, secret scanning, push
   protection, and private vulnerability reporting.
3. Permit the SHA-pinned actions used by `.github/workflows/security.yml` in the
   selected-actions allowlist: `github/codeql-action`,
   `actions/dependency-review-action`, `gitleaks/gitleaks-action`,
   `anchore/sbom-action`, `aquasecurity/trivy-action`,
   `sigstore/cosign-installer`, and `zaproxy/action-baseline`.
4. Add every check in `policy.json.requiredChecks` to the protected-main ruleset.
   Configure code-scanning merge protection to reject `high` and `critical` alerts
   from CodeQL rather than relying only on the analyzer process exit code. Add the
   image/signature and staging DAST checks before production rollout enables those
   paths.
5. Create the protected `staging-security` environment. Add an isolated account named
   with prefix `ds-security-dast-`, store only its short-lived token as
   `STAGING_DAST_TOKEN`, restrict it to synthetic staging data, and deny production IAM.
6. Configure artifact retention to at least 90 days. The release workflow must download
   the security artifacts, attach them to the release, and write tested commit, image
   digest, signature issuer/identity, and scan run IDs into deployment provenance.
7. Verify settings via the GitHub UI/API and run the workflow manually against staging.
   Never point DAST at production.

Repository settings remain declarative until these steps are completed. Plan or
entitlement failures must be recorded as blockers; do not weaken the gates.

## Local verification

```bash
pnpm --filter @repo/testing test:security
pnpm --filter @repo/testing exec node --import tsx --test \
  src/security-gates/security-gates.test.ts
pnpm exec tsc --noEmit --strict --exactOptionalPropertyTypes \
  --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck \
  packages/testing/src/security-gates/{contracts,fixtures,index}.ts
node scripts/validate-github-governance.mjs
```
