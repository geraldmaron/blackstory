#  — Repository reconnaissance and implementation baseline

**Date:** 2026-07-16
**Workspace:** `/Users/geralddagher/Developer/Projects/black-book`
**Source beads:** BlackStory Web Application Execution Beads (PDF)
**Acceptance status:** **done** — mapping + gaps + bead adjustments complete; bootstrap/test/build/typecheck verified exit 0 on 2026-07-16

---

## 1. Current state vs target architecture

| Target (beads / `plan.md`) | Current (verified) | Gap |
|----------------------------|--------------------|-----|
| `apps/web` — public Next.js → Firebase App Hosting | Scaffold: placeholder page, `next`/`react` deps declared | No App Hosting config, no Firebase link, no real UI |
| `apps/admin` — private Next.js → Cloud Run + IAP | Scaffold: placeholder page on port 3001 | No Cloud Run/IAP, no auth |
| `apps/api-public` / `api-submissions` / `api-internal` — Cloud Run | Health stubs + node:test smoke tests | No HTTP server, routing, Armor, or deploy |
| `workers/{research,publication,security}` — Python jobs | uv workspace members + `health()` + pytest smoke | No pipelines, queues, or Cloud Run Jobs |
| `packages/{ui,domain,schemas,firebase,data-access,security,observability,testing,config}` | Present; mostly export stubs. `config` has zod env helpers; `domain` has `EntityId` + living-status invariant helper | Real domain/schemas/data-access/security later (+) |
| `packages/eslint-config`, `packages/typescript-config` | **Empty directories** |  /  |
| `infra/firebase` | README placeholder only |  (`firebase.json`, `.firebaserc`, emulators, App Hosting) |
| `infra/gcp` | README placeholder only |  / + |
| `infra/github` | `workflows/stub.yml` under `infra/github/` (not `.github/`) |  /  /  — no remotes, no branch protection, no OIDC |
| `infra/database` | `docker-compose.yml` PostGIS 16 | Local only; Cloud SQL =  |
| Docs / plan | `plan.md`, `README.md`, `docs/architecture.md`, `.cx/*` | This report completes  mapping deliverable |
| Git | Local repo, **no commits**, **no remotes** | + |

**Branches:** only unborn/local `main` with untracked scaffold (no commit history).
**Package managers:** pnpm 9 (`packageManager`: `pnpm@9.12.3`), Node `>=22` (`.nvmrc` = `22`), Python via uv (`requires-python >=3.12`). Tooling present on machine: `pnpm`, `node` (v25 installed; project wants 22), `uv`, `docker`, `firebase` CLI — **none wired to this project yet**.

---

## 2. Reusable code

**Verdict: scaffold only — no production-reusable application logic.**

| Area | Reuse? | Notes |
|------|--------|-------|
| Monorepo layout + scripts | Yes (as skeleton) | Matches target map; keep and complete under  |
| `@repo/config` | Minimal | `parseNodeEnv`, package-name zod schema |
| `@repo/domain` | Minimal | `asEntityId`, `treatAsLiving` (invariant seed) |
| API / worker health stubs | Smoke only | Useful for CI wiring, not product behavior |
| Next.js pages | Placeholder | Replace under  /  |
| Firebase / GCP / GitHub | None | Placeholders and stubs only |

Do **not** rewrite the skeleton without cause — it already aligns with the target tree.

---

## 3. Conflicting architectural decisions

**None yet.** No ADRs, no Firebase project binding, no alternate service topology in code.
Intent in `docs/architecture.md` / `plan.md` matches bead platform choices. Formal ADRs = ****.

---

## 4. Commands (install / test / build / emulate / deploy)

Documented from root `package.json`, `README.md`, and `scripts/bootstrap.sh`.
**Verification (2026-07-16):** bootstrap agent confirmed `pnpm bootstrap`, `pnpm test`, `pnpm build`, and `pnpm typecheck` after build all exit 0.

**Fixes applied during verification:** package `development` export conditions and root script `--if-present` placement were corrected so workspace scripts run as expected.

**Remaining command gaps:** `pnpm format:check` still has style drift; `pnpm typecheck` depends on a prior successful `pnpm build`; Firebase emulation, real CI, Cloud SQL, and deployment paths are not verified yet.

### Install

```bash
cd /Users/geralddagher/Developer/Projects/black-book
nvm use   # or Node 22+
./scripts/bootstrap.sh
# equivalent:
pnpm bootstrap   # → pnpm install && uv sync --all-packages
```

### Test

```bash
pnpm test        # JS (packages/apps --if-present) + uv run pytest
pnpm test:js
pnpm test:py
```

### Build / typecheck / format

```bash
pnpm build       # packages/** + apps/**
pnpm typecheck
pnpm format:check
pnpm lint        # currently echo stubs in packages/apps → real lint
```

### Local database

```bash
pnpm db:up       # docker compose -f infra/database/docker-compose.yml up -d
pnpm db:down
```

**Not verified in :** Docker image pull / healthcheck was not part of the bootstrap verification pass. Cloud SQL remains .

### Emulate (Firebase)

```text
MISSING — no firebase.json / .firebaserc / emulator config.
Expected later (+), e.g. firebase emulators:start (exact flags TBD with project bootstrap).
```

### Deploy

```text
MISSING — no App Hosting / Cloud Run / GitHub Actions deploy pipelines.
Expected later:  (OIDC),  (Firebase),  (production release).
No deploy command should be claimed until those beads land and are verified.
```

### Per-app (after install)

```bash
pnpm --filter @repo/web dev          # :3000
pnpm --filter @repo/admin dev        # :3001
pnpm --filter @repo/api-public test
pnpm --filter @repo/api-public build
```

---

## 5. Firebase / GitHub understanding

| Integration | Status | Evidence |
|-------------|--------|----------|
| Firebase project | **Absent** | No `firebase.json`, `.firebaserc`, `apphosting.yaml`; `infra/firebase/README.md` states not linked; `@repo/firebase` is a name stub only |
| Firebase emulators | **Absent** | No emulator config; `.gitignore` reserves `.firebase/` for future |
| GitHub remote | **Absent** | `git remote -v` empty; no commits |
| `.github/workflows` | **Absent** | Stub only at `infra/github/workflows/stub.yml` (dispatch noop) — must move/link under `.github/` in /009 |
| Branch protection / CODEOWNERS | **Absent** |  |
| OIDC / WIF deploy identities | **Absent** |  |

**Gap statement:** Treat Firebase and GitHub production integration as **not started**. Do not assume App Check, Auth, App Hosting, or Actions deploy exist.

---

## 6. Gap matrix → +

Requirements are **not** weakened; beads own full acceptance.

| Gap | Owning bead(s) | Notes |
|-----|----------------|-------|
| ADRs for platform choices |  | No conflicts to reconcile first |
| Machine-readable constitution |  | Seed living-status helper in `domain` only |
| Threat model / abuse corpus |  | |
| Env / project isolation (dev/staging/prod + research) |  | GCP README placeholder only |
| Complete monorepo foundation (eslint/tsconfig packages, exports, CI-ready) |  | Skeleton started early — finish acceptance here |
| Design system |  | Empty UI package; required before  / Tranche 5 |
| Quality / test foundation (real lint, coverage, e2e hooks) |  | Lint/test currently stubs or smoke-only |
| GitHub governance (remote, protection, CODEOWNERS) |  | Relocate workflows to `.github/` |
| OIDC deploy identities |  | |
| Firebase bootstrap + emulators |  | Unblocks emulate commands |
| Cloud SQL / PostGIS / SQL Connect |  | Local compose is not Cloud SQL |
| Schema / domain / claims / projections / audit | –020 | |
| Surface separation + hardening | –027 | API apps are health stubs |
| Web security controls |  | **Deps ** — sequence risk |
| Quarantine / SSRF / promotion / cost / IR / security CI | –036 | |
| Research engine | –044, 047 | |
| Public product UI | –057 | Needs  |
| Seed / launch / deploy | –046, 058–063 | Deploy path ends at  |
| Deferred | , 051, 064–066 | Unchanged |

---

## 7. Recommended bead adjustments (greenfield)

Do not drop or soften acceptance criteria. Adjust **sequence / tracking only**:

1. ** started early** — Keep status `in_progress`/`todo` until package acceptance is met (empty `eslint-config` / `typescript-config`, lockfiles, verified `pnpm build`/`pnpm test`). Skeleton does not equal done.
2. ** before ** — Already noted in `plan.md` Epic A remainder. Explicitly schedule  after  (or before Tranche 3 web security), not only before Tranche 5 UI.
3. ** before claiming quality** — Root `lint`/`test` scripts exist but app lint is echo-deferred; document failures until  lands.
4. ** before ** — No GitHub remote yet; governance precedes OIDC.
5. **Firebase commands** — Record as missing until ; do not invent emulator/deploy recipes.
6. **Workflow path** — Move real Actions from `infra/github/workflows/` → `.github/workflows/` when /009 implement CI (keep infra docs as source of truth if desired).

---

## 8.  acceptance checklist (this pass)

| Criterion | Result |
|-----------|--------|
| Current and target state mapped | **Met** — §1 + `repository-map.md` |
| Build/test commands executed or failures documented | **Met** — `pnpm bootstrap`, `pnpm test`, `pnpm build`, `pnpm typecheck` after build verified exit 0 on 2026-07-16 |
| Firebase/GitHub integration understood | **Met** — documented as absent (§5) |
| Subsequent beads adjusted without weakening requirements | **Met** — §7 + `plan.md` updates |

**Overall:**  is `done`. Remaining gaps are intentionally carried forward: Firebase, real CI / workflow placement (/), Cloud SQL, `format:check` style drift, and the current typecheck build-order dependency.
