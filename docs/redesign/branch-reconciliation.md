# Local branch reconciliation

Read-only observation on 2026-11-01 at baseline `c65df582`. No original branch, worktree,
index or running server was changed. Cached remote refs were not refreshed.

| Branch | Relationship to redesign baseline | Treatment |
|---|---|---|
| `staging` (`7bc10632`) | Ancestor, 19 commits behind | Can receive the redesign by fast-forward only after integration gates and owner coordination |
| `main` (`9029dff0`) | Diverged: one unique commit versus 48 on redesign | Preserve the Beads-retirement commit; reconcile instructions/hooks explicitly, not by resetting either branch |
| `fix/release-graph-empty-edge-guard` (`6a3c85a9`) | Committed tip is an ancestor, 47 behind | Three uncommitted graph-guard files remain in its worktree; those changes are not integrated merely because the tip is an ancestor |
| `claude/ui-audit-cleanups-9a0f03` | Three unique commit identities, 41 redesign-only commits | `git cherry` marks all three patch-equivalent to redesign; clean worktree, candidate for retirement after owner confirmation |
| `claude/ui-table-buttons-2cfa09` | Five unique commit identities, 41 redesign-only commits | All five patch-equivalent; clean worktree, same ownership gate |
| `claude/ui-tokens-cleanup-207a93` | Six unique commit identities, 41 redesign-only commits | All six patch-equivalent; clean worktree, same ownership gate |

Seven additional `worktree-agent-*` checkouts have tracked modifications or additions. Their
scopes include admin observer/access UI, motion/map/phone behavior, editorial cases, CSS,
Queue and Footprint work. Some may duplicate subsequently integrated work, but content
comparison and ownership are required to establish that. Several also expose untracked
dependency links; do not delete them as unexplained source or assume an active owner from
their existence.

Native `claude agents --json --cwd <primary-repo>` returned `[]`; `lsof` still showed Claude
process working directories in BlackStory. Neither observation identifies a current writer.
The supported CLI exposes no noninteractive message command in its help. Resuming, attaching
or stopping a process would not establish a safe ownership handshake. No such action was
attempted. The initial read-only Sonnet attempt exited before authentication. Later scoped Sonnet implementation tasks succeeded through the existing Max CLI login; see local-handoff.md. That does not identify the original owner.

Until ownership is resolved, new work uses isolated local clones. The integration clone's
`origin` is the local primary checkout, not GitHub. Any later fetch/pull/push command must
account for that distinction. No push or deployment is authorized in this task.


At source candidate `6ae2b4a4`, the primary checkout remains `c65df582` with only its old
untracked HANDOFF.md. The isolated candidate has recoverable local commits and a read-only
preview on3103. Canonical integration and original branch deletion remain unattempted pending
owner handoff, as directed by the coordinator's parent. No force reset, branch deletion, push
or deployment occurred.
