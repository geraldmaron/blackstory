# Solo-dev release pattern (BlackStory)

Practical loop for one person shipping web hotfixes without enterprise ceremony.
Binding detail also lives in `~/Developer/Guides/Workflows.md` (BlackStory solo-dev
hotfix pattern). Public web aligns with ADR-027 (Vercel) — merging to `main` is the deploy;
there is no separate Vercel promote step (repo-8ary, repo-h1b2). Admin now deploys inside the
same `apps/web` Vercel project (2026-09-11, repo-z3g1f); the old ADR-006 App Hosting promote
path is retired.

## When to use which branch

| Situation | Do this |
|-----------|---------|
| Prod bug on `main` (data plane, rendering, auth) | Hotfix branch **from `origin/main`**, tiny PR, merge — the merge ships that SHA to Vercel Production automatically |
| Large feature branch (mobile cutover, redesign) | Never merge the whole tip to fix a prod bug — merging to `main` goes live immediately; cherry-pick or re-land the minimal fix onto `main` instead |
| Local experiment | Feature branch only; never merge to `main` |

**Rule:** Vercel builds the monorepo at a git SHA from Root Directory `apps/web`, and Production
tracks `main` directly — merging a 40-commit divergent branch ships all of it, live, with no
review step after the merge. Prefer a 1–2 commit hotfix off `main`.

## Loop (happy path)

```text
1. bd create / claim          # track the bug
2. branch from origin/main    # fix/<short-name>
3. fix + tests                # keep the diff small
4. preflight (below)          # lockfile + dynamic routes
5. commit + push + PR → main
6. merge PR — Vercel auto-builds the merge commit and aliases it to Production immediately
7. smoke production (blackstory.app) — there is no Preview-then-promote step to do first
8. bd close + Guides note    # if a new pitfall appeared
```

## Preflight (before merging to main)

```bash
# Frozen lockfile must match package.json (Vercel CI=true install)
pnpm install --frozen-lockfile

# Routes that need RUNTIME secrets (DATABASE_URL) must not static-bake seed
rg -n "force-dynamic" apps/web/src/app/entity/\[id\]/page.tsx apps/web/src/app/\(map\)/layout.tsx

# Postgres SoR must refuse Dunbar seed on miss (list + single-entity)
rg -n "refusing seed fallback" apps/web/src/lib/public-data/source.ts \
  apps/web/src/lib/runtime-hardening/degraded-mode.ts
```

If you remove a dependency from any `package.json`, run `pnpm install` and **commit
`pnpm-lock.yaml` in the same PR**. Frozen-lockfile mismatch fails Vercel builds
with `ERR_PNPM_OUTDATED_LOCKFILE`.

## After merge (Vercel deploys automatically)

```bash
SHA="$(git rev-parse HEAD)"   # must be 40-char; already pushed to GitHub
# Once the PR is merged to main, Vercel builds this commit and aliases it straight to
# Production (blackstory.app, www.blackstory.app) — no dashboard step, no `vercel promote`.
```

Do not merge a second hotfix on top until the first deployment finishes or fails — Vercel builds
merges to `main` in order, and each one goes live as soon as its build completes.

### Admin-only hotfix (superseded — kept for history)

This App Hosting rollout procedure was already leftover before admin moved to Vercel
(2026-07-25), and now `/admin` (`apps/web/src/admin`, `apps/web/src/app/admin`) is a route group
inside the single `apps/web` deployment — there is no separate admin target to roll out, and a
fix there ships with the same `apps/web` merge as any other hotfix, above. Does not apply.

```bash
SHA="$(git rev-parse HEAD)"   # must be pushed to GitHub; firebase login first
firebase apphosting:rollouts:create black-book-admin-production \
  --project=black-book-efaaf \
  --git-commit="$SHA" \
  --force
# wait for build green in Firebase console / Cloud Build
```

If rollout returns **409 unable to queue**, another rollout is in flight — wait, then retry.
Config: root `apphosting.admin.yaml`; backend `black-book-admin-production`.

## Post-deploy smoke (entity / Postgres SoR)

```bash
# Seed-cluster ids must read live release, not seed-snapshot
for id in ent_15th_st_church_001 ent_dunbar_school_001 ent_1199seiu_healthcare_workers_001; do
  echo "=== $id ==="
  curl -sS "https://blackstory.app/entity/$id" | rg -o 'seed-snapshot|rel_seed_001' | sort | uniq -c
  curl -sS -D - -o /dev/null "https://blackstory.app/entity/$id" | rg -i 'x-nextjs-prerender|cache-control'
done
```

Expect: `rel_seed_001` only; no `seed-snapshot`; preferably no `x-nextjs-prerender: 1`
on entity pages after the force-dynamic fix.

Preview host: `https://blackstory-geraldmarons-projects.vercel.app` (or branch-specific Preview URL,
for branches other than `main` — a PR branch, not the merge itself).

## Hygiene for a one-person repo

- Prefer **merge PR → main** for hotfixes so `main` matches what production runs — the merge is
  what ships it.
- CI red on unrelated lint/typecheck debt: still merge and rely on a green **Vercel build**;
  do not expand the hotfix to “fix all of main CI” unless the build itself fails.
- Keep beads (`bd`) for the bug; close with the production smoke evidence.
- New pitfall → one short section in `~/Developer/Guides/Workflows.md` the same day.

## Anti-patterns

- Merging `redesign/*` or a mobile cutover tip to `main` to fix a web prod bug — it ships
  everything on that branch to Production immediately
- Relying on CDN `s-maxage` alone without `force-dynamic` / `revalidate` when RUNTIME env differs from BUILD
- Silent seed fallback under `PUBLIC_DATA_SOURCE=postgres`
- Editing `package.json` without refreshing `pnpm-lock.yaml`
- Using `*.hosted.app` URLs for public web smoke — public web is Vercel only (ADR-027)
