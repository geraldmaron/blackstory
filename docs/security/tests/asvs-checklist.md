# OWASP ASVS and API security checklist

This checklist tailors OWASP ASVS 4.0.3 and OWASP API Security Top 10 controls to
Blap. Automated checks use synthetic fixtures and emulators; they never attack
production or use production data.

## Identity and access control

- [x] V2/V4: anonymous and end-user identities cannot invoke internal publication.
  `packages/testing/src/security-gates/security-gates.test.ts`
- [x] V4 / API1 BOLA: a user cannot read or mutate another user's submission by ID.
- [x] V4 / API5 BFLA: research workers cannot activate releases; publication workers
  and MFA publication staff are explicitly allowed.
- [x] V2: Firebase administrator permission checks reject end-user claims.
- [ ] Human: staging DAST identity has synthetic-only data, least privilege, short-lived
  credentials, and no production IAM.

## Input, output, and browser security

- [x] V5: mass-assignment fixtures cannot set owner, moderation, publication, or roles.
- [x] V5 / API8: oversized and regex-shaped queries fail closed.
- [x] V5: oversized submissions fail validation.
- [x] V5/V12: submitted URLs reject loopback, private, metadata, and non-public DNS.
- [x] V5: untrusted HTML text is escaped for text/attribute contexts.
- [x] V3/V4: state-changing browser requests require same-origin double-submit CSRF proof.
- [ ] Human: browser integration tests verify CSP, Trusted Types where adopted, secure
  cookies, frame restrictions, and context-specific URL/CSS/JavaScript encoding.

## Resource consumption and abuse

- [x] V11 / API4: exhausted source-fetch budgets hard-stop.
- [x] API4: search complexity and submission byte limits are deterministic.
- [x] API6: only declared business flows can activate a publication release.
- [ ] BB-059: staging load test verifies 429 behavior, queue depth, concurrency, and
  public snapshot availability under sustained abuse.

## Supply chain, configuration, and verification

- [x] CodeQL security-extended scanning is SHA-pinned.
- [x] Dependency review blocks high and critical vulnerabilities.
- [x] Gitleaks and GitHub secret scanning/push-protection policy are defined.
- [x] SPDX JSON SBOM generation and 90-day artifact retention are defined.
- [x] Trivy scans dependencies, secrets, infrastructure misconfiguration, and release images.
- [x] Suppression schema requires reason, owner, and expiration; expired entries fail.
- [x] Cosign validates the immutable release digest against GitHub Actions OIDC identity.
- [ ] Human: enable repository security features and required checks described in
  `infra/github/security-gates/README.md`.

## DAST and release promotion

- [x] ZAP baseline is manually dispatchable only against an HTTPS host containing
  `staging`, through the protected `staging-security` environment.
- [x] DAST requires identity prefix `ds-security-dast-` and a protected token.
- [x] Production DAST is forbidden.
- [x] Release evidence validation requires the deployed commit to equal the tested
  commit and the deployed digest to equal the scanned, signed digest.
- [ ] BB-062 integration: production workflow consumes the image/signature gate,
  downloads security artifacts, attaches them to the release, and records run IDs.

Unchecked human or downstream items are release blockers when applicable; they are not
implicitly waived by passing local tests.
