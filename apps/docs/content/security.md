---
title: Security posture
description: Hostile-environment defaults without dumping the internal threat corpus.
nav: concepts
order: 4
---

# Security posture

BlackStory assumes a hostile environment for public surfaces and contribution
intake. The product promise depends on that assumption: a public page is only as
trustworthy as the gates between research and release.

## Defaults

- Public clients never write canonical history.
- Submissions land in quarantine; compromise of intake must not equal publish.
- Research credentials cannot promote or deploy.
- Living residential addresses are never returned publicly; unknown living
  status is treated as living.
- Production identifiers fail closed in local tests (`pnpm test:preflight`).
- GitHub Actions stay read-only by default; third-party actions pin commit SHAs.
- External URLs are untrusted; public request paths do not synchronously fetch
  arbitrary remote content.

## Surfaces

| Surface | Trust posture |
|---------|---------------|
| `apps/web` | Public read of released projections |
| `apps/api-public` | Public read / search / location with abuse controls |
| `apps/api-submissions` | Untrusted intake into quarantine |
| `apps/admin` | Authenticated operators only |
| `apps/api-internal` | Private publication and control |
| Workers / Functions | Research and batch only; cannot publish |

## Reporting

See [`SECURITY.md`](https://github.com/geraldmaron/blackstory/blob/main/SECURITY.md)
in the repository for private vulnerability reporting.

Internal threat model and abuse corpus live under `docs/security/` for operators.
They are not republished here in full on purpose: this page states the posture
readers and contributors need, without turning the public docs site into a
target map.
