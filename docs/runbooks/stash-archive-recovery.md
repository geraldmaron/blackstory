# Stash archive recovery

On 2026-08-03 the repo carried 25 stashes dating from 2026-07-19 to 07-25, left behind by
agent sessions parking work to free a worktree. All 25 were audited, archived to refs, and
cleared from `git stash list`.

Nothing was discarded. Each stash commit is preserved under `refs/stash-archive/`, which
keeps it reachable and safe from garbage collection.

## Listing what is archived

```bash
git for-each-ref refs/stash-archive --format='%(refname:short)  %(objectname:short)'
```

## Inspecting one

```bash
git show --stat refs/stash-archive/13-on-fix-entity-postgres-seed-bake-firebase-strip
```

## Restoring one to the stash list

```bash
git stash store -m "restored from archive" refs/stash-archive/<name>
```

Or apply it directly, expecting conflicts against a much newer tree:

```bash
git stash apply refs/stash-archive/<name>
```

## Why they were cleared rather than applied

Every stash predates `bf797a98 style: format the repo to prettier baseline and gate it in
CI`, which reformatted the tree, so all of them conflict on contact.

More importantly, comparing each stash against `HEAD` showed the stash to be the *older*
side in every case — for example `apps/web/src/app/shell.css` was 900 lines shorter in the
stash than in `HEAD`, and `packages/operator-cli/src/cli.ts` 1060 lines shorter. Applying
any of them would have reverted shipped work rather than recovering lost work.

Breakdown of the 25:

| Group | Count | Disposition |
| --- | --- | --- |
| `.beads/issues.jsonl` only (plus one empty stash) | 9 | Generated export; the Dolt DB is authoritative |
| Targets deleted in the Firebase to Supabase cutover | 4 | Source files no longer exist |
| Superseded by later commits in the same area | 12 | Landed by other means; see the log per path |

A secret-shaped-content scan over all 25 came back clean, which is why archiving as plain
refs is acceptable.

## Caveat

`refs/stash-archive/` is **local to this clone**. It is not pushed and will not survive a
fresh clone. Push it deliberately if the history needs to outlive this working copy:

```bash
git push origin 'refs/stash-archive/*:refs/stash-archive/*'
```

Note that doing so publishes unreviewed work-in-progress to the remote.
