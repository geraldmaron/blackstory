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

## Running subagents that edit files

**Concurrent agents must not share one git working tree.** Spawn them with
`isolation: "worktree"` (the Agent tool's own flag) so each gets its own checkout, or run them one
at a time.

This is not a style preference. On 2026-08-05 three agents were dispatched at once on
non-overlapping *files*, which looked safe. One of them ran a broad `git checkout` to undo its own
work and silently reverted another agent's already-verified, already-reviewed edits. Non-
overlapping files are not enough; they also share a git index, a stash, and a working tree, and any
agent that touches git destroys the others' work.

Rules for any file-editing subagent:

- Give it `isolation: "worktree"`, or run it alone.
- Tell it explicitly not to run `git add`, `commit`, `push`, `stash`, `checkout`, or `restore` —
  the orchestrator owns version control.
- Tell it not to run `bd` — the orchestrator owns issue bookkeeping, and concurrent writers churn
  `.beads/issues.jsonl`.
- Review the actual `git diff` before believing the report. In that same run, one agent reported
  "no non-comment modifications" while having edited a test assertion, and another reported success
  on an edit that introduced a user-visible regression.
- Check `git status` for files nobody was asked to touch (generated files like `next-env.d.ts`
  reappear this way).

Small models are fine for genuinely mechanical work, but "mechanical" is a claim to verify, not
assume. A one-line regex widening in that run would have rendered "pre-Columbian" as
"pre to Columbian" in production.

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
   git push origin HEAD:staging
   git status  # MUST show local branch is up to date with what you pushed
   ```

   There is **no Dolt remote on this project and there is not going to be one.** Do not run
   `bd dolt push` and do not report its "no remote is configured" output as a problem to solve.
   Beads data reaches the remote the same way everything else does: the pre-commit hook exports
   `.beads/issues.jsonl`, and `git push` carries it.
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

## Web local QA (agents)

The web dev server is `preview_start {name: "web"}` on port 3048.

**If something is already listening on 3048, attach to it — do not start a second one and do not
kill the running process.** It is probably the developer's own server.

```
preview_start {url: "http://localhost:3048/"}
```

`autoPort` does not help here and should not be added to `.claude/launch.json`. Next 16 holds a
dev lock per *directory*, not per port: a second `next dev` on `apps/web` binds its assigned port,
prints "Ready", and is then killed by the first instance's lock. The port was never the conflict.

The server is Postgres-backed (`dev-web.sh` loads `apps/web/.env.local` and sets
`PUBLIC_DATA_SOURCE=postgres`), so a preview reflects live `bb_public` data, not seed.

To run a one-off script against the same data, source the env and use the dev export condition —
without `--conditions development` the workspace packages fail to resolve:

```bash
cd apps/web && set -a && . ./.env.local && set +a && node --conditions development --import tsx <script>.mts
```

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
