# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
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

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
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

## BlackStory research skills

Research playbooks live in `.claude/skills/blackstory/`. CLI pointers load a verb from
`docs/research/research-operations.md`. Judgment playbooks (`entity-verify`,
`claim-corroborate`, `entity-complete`, `coverage-target`, `publish-preview`) have unique
content. See `AGENTS.md` for the lane index.

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
