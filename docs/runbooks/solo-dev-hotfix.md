# Solo-dev release pattern (BlackStory)

Practical loop for one person shipping web hotfixes without enterprise ceremony.
Binding detail also lives in `~/Developer/Guides/Workflows.md` (BlackStory solo-dev
hotfix & promote pattern). Aligns with ADR-006 (explicit App Hosting promote only).

## When to use which branch

| Situation | Do this |
|-----------|---------|
| Prod bug on `main` (data plane, rendering, auth) | Hotfix branch **from `origin/main`**, tiny PR, promote that SHA |
| Large feature branch (mobile cutover, redesign) | Never promote the whole tip to prod; cherry-pick or re-land the minimal fix onto `main` |
| Local experiment | Feature branch only; no App Hosting promote |

**Rule:** App Hosting builds the whole monorepo at a git SHA. Promoting a 40-commit
divergent branch ships all of it. Prefer a 1–2 commit hotfix off `main`.

## Loop (happy path)

```text
1. bd create / claim          # track the bug
2. branch from origin/main    # fix/<short-name>
3. fix + tests                # keep the diff small
4. preflight (below)          # lockfile + dynamic routes
5. commit + push + PR → main
6. promote SHA → staging
7. smoke staging
8. promote same SHA → production
9. smoke production
10. bd close + Guides note    # if a new pitfall appeared
```

## Preflight (before promote)

```bash
# Frozen lockfile must match package.json (App Hosting CI=true install)
pnpm install --frozen-lockfile

# Routes that need RUNTIME secrets (DATABASE_URL) must not static-bake seed
rg -n "force-dynamic" apps/web/src/app/entity/\[id\]/page.tsx apps/web/src/app/\(map\)/layout.tsx

# Postgres SoR must refuse Dunbar seed on miss (list + single-entity)
rg -n "refusing seed fallback" apps/web/src/lib/public-data/source.ts \
  apps/web/src/lib/runtime-hardening/degraded-mode.ts
```

If you remove a dependency from any `package.json`, run `pnpm install` and **commit
`pnpm-lock.yaml` in the same PR**. Frozen-lockfile mismatch fails App Hosting builds
with `ERR_PNPM_OUTDATED_LOCKFILE`.

## Promote (local Firebase CLI until WIF is live)

```bash
SHA="$(git rev-parse HEAD)"   # must be 40-char; already pushed to GitHub
bash infra/github/release-pipeline/promote-app-hosting.sh "$SHA" staging
# wait for build green in Firebase console / Cloud Build
bash infra/github/release-pipeline/promote-app-hosting.sh "$SHA" production
```

If promote returns **409 unable to queue**, another rollout is in flight — wait, then retry.
Do not promote a second SHA on top until the first build finishes or fails.

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

Staging host:
`https://black-book-web-staging--black-book-efaaf.us-central1.hosted.app`

## Hygiene for a one-person repo

- Prefer **merge PR → main** for hotfixes so `main` matches what production runs.
- CI red on unrelated lint/typecheck debt: still promote a green **App Hosting build**;
  do not expand the hotfix to “fix all of main CI” unless the build itself fails.
- Keep beads (`bd`) for the bug; close with the production smoke evidence.
- New pitfall → one short section in `~/Developer/Guides/Workflows.md` the same day.

## Anti-patterns

- Promoting `redesign/*` or mobile cutover tips to fix a web prod bug
- Relying on CDN `s-maxage` alone without `force-dynamic` / `revalidate` when RUNTIME env differs from BUILD
- Silent seed fallback under `PUBLIC_DATA_SOURCE=postgres`
- Editing `package.json` without refreshing `pnpm-lock.yaml`
