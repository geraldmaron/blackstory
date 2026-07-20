---
title: Security posture
description: Hostile-environment defaults without dumping the internal threat corpus.
nav: concepts
order: 4
---

# Security posture

BlackStory assumes a hostile environment for public surfaces and contribution
intake.

## Defaults

- Public clients never write canonical history.
- Submissions land in quarantine; compromise of intake must not equal publish.
- Research credentials cannot promote or deploy.
- Production identifiers fail closed in local tests (`pnpm test:preflight`).
- GitHub Actions stay read-only by default; third-party actions pin commit SHAs.

## Reporting

See [`SECURITY.md`](https://github.com/geraldmaron/blackstory/blob/main/SECURITY.md)
in the repository for private vulnerability reporting.

Internal threat model and abuse corpus live under `docs/security/` for operators
and agents — not republished here in full.
