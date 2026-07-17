# GitHub repository governance (BB-009) + OIDC deploy identities (BB-010)

Declarative governance for the Black Book GitHub repository. Local policy is enforced by `pnpm validate:governance`. Remote settings are applied only with an authenticated admin `gh` session. WIF/OIDC cloud resources are declarative stubs until `apply-wif.sh --apply`.

## Status (verified 2026-07-16)

| Item | State |
|------|--------|
| Local governance files | Present under `.github/` + `infra/github/` |
| Git remote | **Absent** (`git remote -v` empty) |
| `gh` auth | Token in keyring **invalid** (`gh auth status`) |
| Rulesets / Actions allowlist / secret scanning on GitHub | **Not applied** (cannot verify via `gh api`) |
| OIDC deploy workflow stub | `.github/workflows/deploy-production.yml` (`workflow_dispatch` only) |
| GCP WIF pool/provider | **Not applied** — see `infra/gcp/wif/` + `scripts/apply-wif.sh` |

Do not claim GitHub settings are live until `infra/github/scripts/check-governance.sh` passes without `--allow-missing-remote`.

## Artifacts

| Path | Role |
|------|------|
| `.github/CODEOWNERS` | Path owners for security, infra, policies, DB, publication |
| `.github/dependabot.yml` | npm / pip / github-actions weekly updates |
| `SECURITY.md` | Security policy + private reporting instructions |
| `rulesets/main-protection.json` | Main branch ruleset (PR, checks, no force-push/delete, resolved threads) |
| `allowed-actions.json` | Selected Actions publishers/patterns (includes `google-github-actions/auth`) |
| `security-settings.json` | Secret scanning, push protection, private vulnerability reporting |
| `scripts/apply-governance.sh` | Dry-run by default; `--apply` mutates via `gh api` |
| `scripts/check-governance.sh` | Read-only verification via `gh api` |
| `scripts/apply-wif.sh` | WIF Terraform dry-run by default; `--apply` mutates GCP |
| `scripts/check-wif.sh` | Read-only WIF inventory (`--allow-missing` for local) |
| `oidc/` | Protected environment stubs + SA key removal path |
| `release-metadata/` | Deployment provenance schema + stub (BB-062) |
| `../../scripts/validate-github-governance.mjs` | Local/CI policy checker (pins, permissions, events, files) |

## Required CI check names

Must match job `name:` values in `.github/workflows/ci.yml` and the ruleset:

- Validate
- Unit Tests (JS Packages)
- Unit Tests (JS Apps)
- Unit Tests (Python)
- Contract Security Accessibility
- Coverage
- Integration Firebase
- Build and Typecheck
- E2E Harness
- Governance

## Local validation

```bash
cd ~/Developer/Projects/black-book
pnpm validate:governance
# or
node scripts/validate-github-governance.mjs

# Remote check (SKIP/exit 0 when no remote if flag set)
./infra/github/scripts/check-governance.sh --allow-missing-remote
```

## Apply once remote + admin exist

Prerequisites:

1. Create the GitHub repository (do **not** invent one without an explicit request).
2. Add the `origin` remote and push `main`.
3. `gh auth login -h github.com` with a token that can administer the repo (rulesets, Actions, security settings).
4. Create CODEOWNER teams on the org (optional but recommended): `security`, `infra`, `policies`, `database`, `publication`, then update `.github/CODEOWNERS`.

Dry-run (safe):

```bash
cd ~/Developer/Projects/black-book
./infra/github/scripts/apply-governance.sh --dry-run
```

Apply:

```bash
./infra/github/scripts/apply-governance.sh --apply
# If main-protection already exists:
./infra/github/scripts/apply-governance.sh --apply --force
```

Verify:

```bash
./infra/github/scripts/check-governance.sh
# Optional: fail when secret scanning entitlements are missing
./infra/github/scripts/check-governance.sh --strict-security
```

Override target repo:

```bash
GH_REPO=owner/name ./infra/github/scripts/apply-governance.sh --dry-run
GH_REPO=owner/name ./infra/github/scripts/check-governance.sh
```

## Production deploy invariant

The main ruleset requires a reviewed PR and green required checks before merge to `main`. Production deploy workflows (BB-010 / BB-062) must deploy only from `main` (or another ruleset-protected ref). Unreviewed branches cannot merge to `main` and therefore cannot be a legitimate production deploy source once those workflows exist.

## OIDC / WIF (BB-010)

Design and commands: [`../gcp/wif/README.md`](../gcp/wif/README.md), [`oidc/README.md`](./oidc/README.md).

```bash
# Local (no cloud mutation)
./infra/github/scripts/apply-wif.sh --dry-run
./infra/github/scripts/check-wif.sh --allow-missing

# After remote + numeric IDs + gcloud ADC + github-deploy SA:
# ./infra/github/scripts/apply-wif.sh --apply
# ./infra/github/scripts/check-wif.sh
```

Deploy stub workflow is **not** a required check. Full rollout pipeline is BB-062.

## Secret scanning note

Enabling secret scanning / push protection / private vulnerability reporting depends on repository visibility and GitHub plan. The apply script warns on API failure; `--strict-security` makes the checker fail closed when those settings are absent.
