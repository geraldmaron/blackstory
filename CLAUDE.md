# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY. Push to `staging`, never directly to `main`
   (see **Branching & Release Policy** below):
   ```bash
   git pull --rebase origin staging
   bd dolt push
   git push origin HEAD:staging
   git status  # MUST show local branch is up to date with what you pushed
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Branching & Release Policy

`main` is GitHub-branch-protected: no direct pushes, no force-pushes, no deletions (PR required
to merge). This is enforced server-side, not just a convention.

- **Day-to-day work** (agent sessions, exploratory commits, WIP) lands on `staging` (or a
  feature branch merged into `staging`) — never pushed straight to `main`.
- **staging → main is an explicit, separate action**, not something a session does as part of
  its normal close-out: open a PR from `staging` to `main` and merge it deliberately (`gh pr
  create --base main --head staging` then `gh pr merge`), only when `staging` is in a state
  intended for release. Do this only when asked, not automatically at session end.
- If you're unsure whether a change belongs on `staging` alone or should also go to `main`,
  default to `staging` and ask.

## Mobile local QA (agents)

**Default:** `pnpm mobile:ios:verify` (Path A, prod-like). Checks api-public + Release app on Simulator; **does not** use Metro.

- Launch/rebuild: `pnpm mobile:ios:release`
- Hot reload only: `pnpm dev:mobile` (Path B)
- Never claim mobile healthy from `127.0.0.1:8081` alone if the dev client may target another port

Details: `AGENTS.md` and `apps/mobile/README.md`.

## Build & Test

_Add your build and test commands here_

```bash
# Example:
# npm install
# npm test
```

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_
