# BB-001 — Repository reconnaissance and implementation baseline

**Date:** 2026-07-16  
**Workspace:** `/Users/geralddagher/Developer/Projects/black-book`  
**Source beads:** Blap Web Application Execution Beads (PDF)  
**Acceptance status:** **done** — mapping + gaps + bead adjustments complete; bootstrap/test/build/typecheck verified exit 0 on 2026-07-16

---

## 1. Current state vs target architecture

| Target (beads / `plan.md`) | Current (verified) | Gap |
|----------------------------|--------------------|-----|
| `apps/web` — public Next.js → Firebase App Hosting | Scaffold: placeholder page, `next`/`react` deps declared | No App Hosting config, no Firebase link, no real UI |
| `apps/admin` — private Next.js → Cloud Run + IAP | Scaffold: placeholder page on port 3001 | No Cloud Run/IAP, no auth |
| `apps/api-public` / `api-submissions` / `api-internal` — Cloud Run | Health stubs + node:test smoke tests | No HTTP server, routing, Armor, or deploy |
| `workers/{research,publication,security}` — Python jobs | uv workspace members + `health()` + pytest smoke | No pipelines, queues, or Cloud Run Jobs |
| `packages/{ui,domain,schemas,firebase,data-access,security,observability,testing,config}` | Present; mostly export stubs. `config` has zod env helpers; `domain` has `EntityId` + living-status invariant helper | Real domain/schemas/data-access/security later (BB-003+) |
| `packages/eslint-config`, `packages/typescript-config` | **Empty directories** | BB-006 / BB-008 |
| `infra/firebase` | README placeholder only | BB-011 (`firebase.json`, `.firebaserc`, emulators, App Hosting) |
| `infra/gcp` | README placeholder only | BB-005 / BB-012+ |
| `infra/github` | `workflows/stub.yml` under `infra/github/` (not `.github/`) | BB-008 / BB-009 / BB-010 — no remotes, no branch protection, no OIDC |
| `infra/database` | `docker-compose.yml` PostGIS 16 | Local only; Cloud SQL = BB-012 |
| Docs / plan | `plan.md`, `README.md`, `docs/architecture.md`, `.cx/*` | This report completes BB-001 mapping deliverable |
| Git | Local repo, **no commits**, **no remotes** | BB-009+ |

**Branches:** only unborn/local `main` with untracked scaffold (no commit history).  
**Package managers:** pnpm 9 (`packageManager`: `pnpm@9.12.3`), Node `>=22` (`.nvmrc` = `22`), Python via uv (`requires-python >=3.12`). Tooling present on machine: `pnpm`, `node` (v25 installed; project wants 22), `uv`, `docker`, `firebase` CLI — **none wired to this project yet**.

---

## 2. Reusable code

**Verdict: scaffold only — no production-reusable application logic.**

| Area | Reuse? | Notes |
|------|--------|-------|
| Monorepo layout + scripts | Yes (as skeleton) | Matches target map; keep and complete under BB-006 |
| `@blap/config` | Minimal | `parseNodeEnv`, package-name zod schema |
| `@blap/domain` | Minimal | `asEntityId`, `treatAsLiving` (invariant seed) |
| API / worker health stubs | Smoke only | Useful for CI wiring (BB-008), not product behavior |
| Next.js pages | Placeholder | Replace under BB-007 / BB-048 |
| Firebase / GCP / GitHub | None | Placeholders and stubs only |

Do **not** rewrite the skeleton without cause — it already aligns with the target tree.

---

## 3. Conflicting architectural decisions

**None yet.** No ADRs, no Firebase project binding, no alternate service topology in code.  
Intent in `docs/architecture.md` / `plan.md` matches bead platform choices. Formal ADRs = **BB-002**.

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
pnpm lint        # currently echo stubs in packages/apps → real lint BB-008
```

### Local database

```bash
pnpm db:up       # docker compose -f infra/database/docker-compose.yml up -d
pnpm db:down
```

**Not verified in BB-001:** Docker image pull / healthcheck was not part of the bootstrap verification pass. Cloud SQL remains BB-012.

### Emulate (Firebase)

```text
MISSING — no firebase.json / .firebaserc / emulator config.
Expected later (BB-011+), e.g. firebase emulators:start (exact flags TBD with project bootstrap).
```

### Deploy

```text
MISSING — no App Hosting / Cloud Run / GitHub Actions deploy pipelines.
Expected later: BB-010 (OIDC), BB-011 (Firebase), BB-062 (production release).
No deploy command should be claimed until those beads land and are verified.
```

### Per-app (after install)

```bash
pnpm --filter @blap/web dev          # :3000
pnpm --filter @blap/admin dev        # :3001
pnpm --filter @blap/api-public test
pnpm --filter @blap/api-public build
```

---

## 5. Firebase / GitHub understanding

| Integration | Status | Evidence |
|-------------|--------|----------|
| Firebase project | **Absent** | No `firebase.json`, `.firebaserc`, `apphosting.yaml`; `infra/firebase/README.md` states not linked; `@blap/firebase` is a name stub only |
| Firebase emulators | **Absent** | No emulator config; `.gitignore` reserves `.firebase/` for future |
| GitHub remote | **Absent** | `git remote -v` empty; no commits |
| `.github/workflows` | **Absent** | Stub only at `infra/github/workflows/stub.yml` (dispatch noop) — must move/link under `.github/` in BB-008/009 |
| Branch protection / CODEOWNERS | **Absent** | BB-009 |
| OIDC / WIF deploy identities | **Absent** | BB-010 |

**Gap statement:** Treat Firebase and GitHub production integration as **not started**. Do not assume App Check, Auth, App Hosting, or Actions deploy exist.

---

## 6. Gap matrix → BB-002+

Requirements are **not** weakened; beads own full acceptance.

| Gap | Owning bead(s) | Notes |
|-----|----------------|-------|
| ADRs for platform choices | BB-002 | No conflicts to reconcile first |
| Machine-readable constitution | BB-003 | Seed living-status helper in `domain` only |
| Threat model / abuse corpus | BB-004 | |
| Env / project isolation (dev/staging/prod + research) | BB-005 | GCP README placeholder only |
| Complete monorepo foundation (eslint/tsconfig packages, exports, CI-ready) | BB-006 | Skeleton started early — finish acceptance here |
| Design system | BB-007 | Empty UI package; required before BB-028 / Tranche 5 |
| Quality / test foundation (real lint, coverage, e2e hooks) | BB-008 | Lint/test currently stubs or smoke-only |
| GitHub governance (remote, protection, CODEOWNERS) | BB-009 | Relocate workflows to `.github/` |
| OIDC deploy identities | BB-010 | |
| Firebase bootstrap + emulators | BB-011 | Unblocks emulate commands |
| Cloud SQL / PostGIS / SQL Connect | BB-012 | Local compose is not Cloud SQL |
| Schema / domain / claims / projections / audit | BB-013–020 | |
| Surface separation + hardening | BB-021–027 | API apps are health stubs |
| Web security controls | BB-028 | **Deps BB-007** — sequence risk |
| Quarantine / SSRF / promotion / cost / IR / security CI | BB-029–036 | |
| Research engine | BB-037–044, 047 | |
| Public product UI | BB-048–057 | Needs BB-007 |
| Seed / launch / deploy | BB-045–046, 058–063 | Deploy path ends at BB-062 |
| Deferred | BB-031, 051, 064–066 | Unchanged |

---

## 7. Recommended bead adjustments (greenfield)

Do not drop or soften acceptance criteria. Adjust **sequence / tracking only**:

1. **BB-006 started early** — Keep status `in_progress`/`todo` until package acceptance is met (empty `eslint-config` / `typescript-config`, lockfiles, verified `pnpm build`/`pnpm test`). Skeleton does not equal done.
2. **BB-007 before BB-028** — Already noted in `plan.md` Epic A remainder. Explicitly schedule BB-007 after BB-006 (or before Tranche 3 web security), not only before Tranche 5 UI.
3. **BB-008 before claiming quality** — Root `lint`/`test` scripts exist but app lint is echo-deferred; document failures until BB-008 lands.
4. **BB-009 before BB-010** — No GitHub remote yet; governance precedes OIDC.
5. **Firebase commands** — Record as missing until BB-011; do not invent emulator/deploy recipes.
6. **Workflow path** — Move real Actions from `infra/github/workflows/` → `.github/workflows/` when BB-008/009 implement CI (keep infra docs as source of truth if desired).

---

## 8. BB-001 acceptance checklist (this pass)

| Criterion | Result |
|-----------|--------|
| Current and target state mapped | **Met** — §1 + `repository-map.md` |
| Build/test commands executed or failures documented | **Met** — `pnpm bootstrap`, `pnpm test`, `pnpm build`, `pnpm typecheck` after build verified exit 0 on 2026-07-16 |
| Firebase/GitHub integration understood | **Met** — documented as absent (§5) |
| Subsequent beads adjusted without weakening requirements | **Met** — §7 + `plan.md` updates |

**Overall:** BB-001 is `done`. Remaining gaps are intentionally carried forward: Firebase (BB-011), real CI / workflow placement (BB-008/BB-009), Cloud SQL (BB-012), `format:check` style drift, and the current typecheck build-order dependency.
