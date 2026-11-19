# Project Instructions for AI Agents

## Running subagents that edit files

**Concurrent agents must not share one git working tree.** Non-overlapping files are not
enough: agents also share the git index and stash, and one agent's `git checkout` has reverted
another's verified edits.

- Give each file-editing subagent `isolation: "worktree"` (the Agent tool's own flag), or run it
  alone.
- Worktrees are cut from `main`, not the working branch. Make the agent's first command
  `git reset --hard <staging tip sha>` or it works on stale code.
- Tell it not to run `git add`, `commit`, `push`, `stash`, `checkout`, or `restore`; the
  orchestrator owns version control.
- Review the actual `git diff` before believing the report. Reports have claimed no changes
  while editing a test assertion.
- Check `git status` for files nobody was asked to touch (generated files like `next-env.d.ts`
  reappear this way).
- Small models are fine for mechanical work, but verify that the work is mechanical.

## Session Completion

1. **Record remaining work** - Name anything that needs follow-up in your final report
   1a. **Then work the follow-ups you just recorded.** A follow-up that is bounded data or
   validation work inside the session's own epic (a second source, a dead link, a stale
   facet, a floor that now passes, a record the pass could not reach) is the next step of
   the same job, not a hand-off. Fan out and finish it in this session, measured the same
   way, before closing out. File-and-stop only when the follow-up needs a human decision
   (policy, scope, an irreversible change) or lies outside the epic, and say which. The
   operator should never have to reply "now do the follow-ups".
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Commit and push to `staging`**, never `main` (see **Branching & Release Policy** below),
   unless the owner has said to hold pushes:

   ```bash
   git push origin HEAD:staging
   ```

   If the push is rejected, rebase onto `origin/staging` and retry. Do not report work as pushed
   until `git status` confirms it.

**Before opening a staging → main PR**, run `fnm exec --using=22 -- ./scripts/ci-local.sh`.
`pnpm test` is not equivalent: CI decides which lanes run from the changed paths, and two of
those predicates are easy to miss by inspection — touching `packages/public-contracts` fires
the whole mobile lane (it is the mobile token source), and touching `packages/research-kernel`
fires the Python lane (no `.py` file required). `scripts/ci-local.sh` mirrors
`.github/workflows/ci.yml` lane-for-lane instead of guessing. The script requires Node 22
(the repo's `.nvmrc`) because `node:test`'s reporter output format differs between Node 22 and
24 — running it on 24 can pass locally and still not match what CI reports.
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

## Republishing the CDN catalog after a published write

Direct writes to `published.*` are only for in-place corrections to records that are already
published; new records go through the publisher.

A direct write to `published.release_entities` / `published.search_index` leaves the published
`entities.json` / `search-index.json` stale — the read-side guard only compares `releaseId`, which
an in-place correction does not change. Rebuild the graph, then republish **locally**:

```bash
cd apps/web && set -a && . ./.env.local && set +a && node --conditions development --import tsx ../../packages/ops-data/scripts/publish-release-catalog-artifacts.ts
```

**Then purge the Cloudflare zone** (`docs/security/cost-resource-controls.md`, "purge after an
in-place correction"): public documents are edge-cached for an hour, so a corrected record keeps
its old HTML at Cloudflare until purged. Vercel's own CDN copy refreshes within five minutes by
itself.

**Then stop. Do not run `gh workflow run publish-release-catalog-artifacts.yml` afterwards.** It
runs the same script against the same watermark (`published.release_catalog_publish_watermark`),
so the dispatch is a no-op that spends CI minutes. It has no cron, so a forgotten mutation does
not self-heal.

**If the local upload fails** (`fetch failed (EPIPE: write EPIPE)` on `entities.json`; uploads
over about 5 MB from the owner's Mac have been cut off since 2026-11-08), or there is no local
environment, dispatch the workflow instead and confirm its log says `uploaded`:

```bash
gh workflow run publish-release-catalog-artifacts.yml --ref main -f force=true
```

## BlackStory research skills

Research playbooks are shared across harnesses in `.agents/skills/<skill-name>/SKILL.md`.
The flat `.claude/skills/` entries are symlinks to that source. Edit the canonical files;
do not create a Claude-specific copy. See `docs/research/README.md#skills-and-harness-portability`
for explicit file loading and capability requirements. Command verbs live in
`docs/research/research-operations.md`. Judgment playbooks (`entity-verify`,
`claim-corroborate`, `entity-complete`, `entity-relate`, `coverage-target`, `publish-preview`,
`neo-voice`, `prose-review`, `ringer-review`, `surface-triage`, `intake-review`,
`experience-review`) have unique content. See `AGENTS.md` for the
lane index.

## Web local QA (agents)

The web dev server is `preview_start {name: "web"}` on port 3048.

**If something is already listening on 3048, attach to it — do not start a second one and do not
kill the running process.** It is probably the developer's own server.

```
preview_start {url: "http://localhost:3048/"}
```

`autoPort` does not help here and should not be added to `.claude/launch.json`. Next 16 holds a
dev lock per _directory_, not per port: a second `next dev` on `apps/web` binds its assigned port,
prints "Ready", and is then killed by the first instance's lock. The port was never the conflict.

The server is Postgres-backed (`dev-web.sh` loads `apps/web/.env.local` and sets
`PUBLIC_DATA_SOURCE=postgres`), so a preview reflects live `published` data, not seed.

**A running server does not see a record you RENAME under it.** Entity routes resolve through
`record-first-paint.tsx`'s slug path, which reads process-cached shared sources, so after an
in-place `display_name` change the record's own page returns "Place not found" until the server
restarts. Other edits (an incremental republish, a direct summary or topic write) are picked up
live. A 404 on a just-renamed record is the cache, not your write: verify the row, then restart.

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
