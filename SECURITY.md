# Security Policy

Blap treats supply-chain integrity, secret handling, and private vulnerability reporting as first-class controls (BB-009 / threat T-11, T-12).

## Supported versions

This repository is pre-production. Report issues against the default branch (`main`) once it exists on GitHub. There are no long-term support branches yet.

## Reporting a vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Prefer one of these private channels (in order):

1. **GitHub private vulnerability reporting** — once the repository is on GitHub, use **Security → Advisories → Report a vulnerability** (or the equivalent “Report a vulnerability” button on this file). Enable private reporting when applying `infra/github/security-settings.json`.
2. **Email the maintainer** listed in `.github/CODEOWNERS` (interim: GitHub user `geraldmaron`) with a clear subject such as `Blap security report`.

Include:

- Affected path(s) or component(s)
- Reproduction steps or proof-of-concept (non-destructive)
- Impact assessment (confidentiality / integrity / availability)
- Whether the issue is already public elsewhere

We aim to acknowledge private reports within **7 days** and to provide a remediation plan or status update within **30 days**. Please allow time for coordinated disclosure before publishing details.

## Out of scope for this channel

- Public feature requests and non-security bugs → normal issues/PRs after the remote exists
- Social engineering against maintainers
- Denial-of-service against production before production is cut over (still report if you find a clear DoS bug in code)

## Hardening already encoded in-repo

| Control | Location |
|---------|----------|
| Read-only default workflow permissions | `.github/workflows/ci.yml` |
| Actions pinned to commit SHAs | `.github/workflows/*.yml` + `pnpm validate:governance` |
| No `pull_request_target` with untrusted checkout | policy checker |
| Main-branch ruleset (PR + checks + no force-push/delete + resolved conversations) | `infra/github/rulesets/main-protection.json` |
| CODEOWNERS for security / infra / policies / DB / publication | `.github/CODEOWNERS` |
| Dependabot updates | `.github/dependabot.yml` |
| Secret scanning + push protection (declarative) | `infra/github/security-settings.json` |

## Secret scanning and push protection

When the GitHub remote exists and the plan/org supports it, enable:

- Secret scanning
- Push protection for secrets
- Private vulnerability reporting

Exact apply commands: `infra/github/README.md`. Until applied, treat any leaked credential as incident-worthy and rotate immediately.
