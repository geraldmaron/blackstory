# Security verification

Use the [threat model](../threat-model.md) and [abuse cases](../abuse-cases.md) to choose checks.
A test of a policy function establishes that function's behavior, not deployed middleware, provider
configuration or production authorization. The [framework audit](../../research/framework-audit.md)
records the executed checks and their limits.

## Repository checks

| Boundary | Evidence | Validation |
|---|---|---|
| Threat coverage | `packages/testing/src/security/threat-corpus.test.ts` validates threat IDs, control quadrants, implementation references and residual risks | `pnpm --filter @repo/testing test` |
| Authorization, quotas, URL safety and publication integrity | `packages/testing/src/security-gates/security-gates.test.ts` exercises adversarial fixtures against policy contracts | `pnpm --filter @repo/testing test` |
| Staff/public credential separation | `apps/web/src/admin/canonical-write-boundary.test.ts` and staff authorization tests | `pnpm --filter @repo/web test` |
| Database role denials | `supabase/tests/research-kernel.sql` checks research, publication, source and retention boundaries against an isolated migrated database | `psql -v ON_ERROR_STOP=1 -f supabase/tests/research-kernel.sql` |
| Dependency and source boundaries | Repository validation, pinned Actions and dependency policy | `pnpm validate` and the applicable CI jobs |
| Secrets | Gitleaks on the exact staged files and the ordinary CI secret scan | `gitleaks dir <staged-file-export> --config gitleaks.toml --redact --no-banner` |

Run the complete applicable path through `fnm exec --using=22 -- ./scripts/ci-local.sh` before a
release. Its changed-path predicates determine the required lanes. Passing a smaller helper suite
does not replace that gate. Record skipped jobs and environment limitations explicitly.

## Deployed checks

These need the actual deployment or an isolated representative restore. They remain unproven until
an execution record identifies the tested revision, data and observed result.

1. Public and ordinary user credentials cannot enter staff routes, write canonical history or
   publish. Staff role claims come from trusted Supabase app metadata. Internal operations require
   service identity; the code contract alone does not establish private network isolation.
2. Flood and cache-bypass scenarios exercise the deployed rate-limit store and middleware. Verify
   bounded requests, failure behavior and continued availability of safe public reads. Fixture
   evaluators alone do not prove throttling.
3. Submitted URLs cannot cause synchronous uncontrolled fetches, internal-network access, redirect
   escape or oversized downloads. File acquisition rejects unsafe archive entries. Any new upload
   path requires its own malware, type, size and quarantine checks before exposure.
4. Research output remains a proposal. Prompt injection, duplicate submissions, circular citations
   and semantic similarity cannot bypass evidence, independent review or publication controls.
5. Public records respect stored location precision and living-person address restrictions. Inspect
   actual DTOs, rendered records and logs using representative sensitive fixtures.
6. Recovery restores a matched database, auth, objects and compatible application revision. A prior
   release pointer or an application rollback alone cannot reverse an incompatible schema change.
   Follow [production release](../../runbooks/production-release.md).

## CI evidence and release decision

`.github/workflows/security.yml` owns the configured CodeQL, dependency review, Gitleaks, SBOM,
Trivy, image/signature and manual staging DAST jobs. Some run only when their conditions are met.
An absent or skipped job is not a passing check; manual DAST must never target production.
Provider push protection, live monitoring and account controls need separate verification.

Suppression requirements live in `infra/github/security-gates/suppressions.json`. Each exception
needs a reason, an accountable owner and an expiration. Retain the applicable security artifacts
with the tested commit and release decision. Do not infer a release approval from this checklist.
