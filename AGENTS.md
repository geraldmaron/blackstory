# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
```

There is **no Dolt remote on this project and there is not going to be one.** Do not run
`bd dolt push`. Beads data reaches the remote via the pre-commit hook, which exports
`.beads/issues.jsonl` so an ordinary `git push` carries it.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Mobile local QA (agents)

**Default for mobile smoke / "app works locally": Path A (prod-like).** Production never uses Metro; do not open the Debug dev client and expect prod behavior.

| Goal | Command | Pass signal |
|---|---|---|
| Agent gate (mobile ready) | `pnpm mobile:ios:verify` | api-public live + Release app on booted Simulator; **Metro not required** |
| Launch / rebuild embedded bundle | `pnpm mobile:ios:release` | Release install; relaunch without packager URL |
| Relaunch only | `pnpm mobile:ios:launch` | App runs from embedded bundle |

**Path B (hot reload only):** `pnpm dev:mobile` / `pnpm dev:mobile:verify` when actively editing JS. Never claim mobile healthy from `127.0.0.1:8081` `/status` alone while the iOS dev client may still target another LAN port (`:8082`, `:8083`). Path B verify must pass LAN bundle smoke + simulator packager alignment.

See `apps/mobile/README.md` for setup (`API_BASE_URL=http://127.0.0.1:8080` in `apps/mobile/.env.local`).

## BlackStory research lanes

Two skill kinds live under `.claude/skills/blackstory/`:

- **CLI pointers** (`research-intake`, `discovery-run`, `editorial-enrichment`, `locate`,
  `case-drafting`, `story-craft`, `theme-study`, `triage-graylist`) match a verb and then read
  [`docs/research/research-operations.md`](docs/research/research-operations.md). They do not
  duplicate command flags.
- **Judgment playbooks** (`entity-verify`, `claim-corroborate`, `entity-complete`,
  `entity-relate`, `coverage-target`, `publish-preview`, `neo-voice`, `prose-review`,
  `ringer-review`) carry decision order, source ladders, and Do/Never. They have no
  operator-cli verb of their own.

`blackstory-locate` Census-geocodes a sourced address (no LLM). Finding the place, confirming
which namesake, and assigning era is `blackstory-entity-verify`.

All commands: `node --conditions development --import tsx packages/operator-cli/src/bin.ts <verb> [flags]`. Every verb accepts `--json`; entity targets use `--entity-id`, case targets use `--case-id`. Read the operations doc before running a verb.

| Lane | When to use | Exact command |
|---|---|---|
| research-intake | Turn a URL/topic into a proposed lead (fetched, cited, draft research case) | `research-intake --url "<url>" --operator-id "$USER" --session-id "<id>"` |
| discovery-run | Run a bounded adapter discovery campaign against an assembled batch, get yield | `discovery-run --batch <batch.json> --campaign-id "<id>" --countries US` |
| editorial-run / enrichment-run | Check pending leads, run LLM editorial/enrichment, stage packets (never publish) | `editorial-run --subjects <subjects.json> --provider mock --operator-id "$USER" --session-id "<id>"` |
| backfill-entity | Re-run enrichment/backfill for one known entity id | `backfill-entity --entity-id <id> --provider mock --operator-id "$USER" --session-id "<id>"` |
| prose-run | Short-form prose draft for one subject (lighter than story-research-run) | `prose-run --entity-id <id> --provider mock --operator-id "$USER" --session-id "<id>"` |
| story-research-run | Draft/recommend longform `/stories` articles via citation-gated story packets | `story-research-run --topics <topics.json> --provider mock --operator-id "$USER" --session-id "<id>"` |
| harness-run | Run a thematic study (redlining, urban renewal) and draft ThemeImpactPackets | `harness-run --theme <theme> --metro <metro> --connectors dpla,nps-network-to-freedom,shpo --output <out.json>` |
| locate | Census-geocode a sourced address to lat/lng (no LLM). Finding the place is `blackstory-entity-verify`. | `locate --entity-id <id> --address "<address>" --precision institution --operator-id "$USER" --session-id "<id>"` |
| capture-backfill | Snapshot cited URLs into `source_captures`; `--wayback` secondary-anchors at Save Page Now | `capture-backfill [--commit] [--wayback] [--max-captures 25]` |
| case-drafting (`attach-evidence`) | Check if a research case is review-ready; fill missing evidence | `attach-evidence --case-id "<id>" --description "<what this fills>" --source-url "<url>" --operator-id "$USER" --session-id "<id>"` |
| triage-graylist (`graylist-read`, `attach-evidence`) | Walk parked/weak-signal candidates; corroborate or recommend | `graylist-read --limit 20` (Postgres only — see doc); `attach-evidence` to corroborate |
| expand (stub) | Grow an entity's network outward from an id — pending repo-xez5.4 | `expand --entity-id <id> --depth 1` |

## Brand Language

The binding source is the root `brand/` directory (masters, 4-page guide, token files — see
`docs/ui/brand.md` for the full usage contract). Anything an agent ships that a user can see must
follow it.

**Product name:** BlackStory. Core line: *History, pinned to place.* Support line:
*People. Places. Evidence. Context.* Copy is specific over sweeping, evidence before assertion,
pride without spectacle; invite, do not lecture. Never sensational framings or completeness
overclaims.

**Rebrand-stable code trio** (never rename these for a product rename):

| Layer | Value |
|---|---|
| npm packages | `@repo/*` |
| CSS / tokens | `ds-*` / `--ds-*` |
| Env break-glass | `APP_*` |

User-visible string and assets come from `@repo/config` identity helpers / `apps/web/public/brand/`
role-based paths (`lockup-*.png`, `symbol-*.png`, …).

**Beads are internal ops only.** Never put bead ids in user-facing copy, admin chrome, error
strings, or product source comments. Cite ADRs or capability names. Tracker prefix is `repo-`.

**Color.** Black and paper lead; copper points.

| Role | Hex |
|---|---|
| Black Ink (primary ink; dark canvas) | `#0A0A0A` |
| Charcoal (dark surface) | `#161616` |
| Archive Paper (light canvas) | `#F4EFE5` |
| Surface (raised light surface) | `#FBF8F2` |
| Copper Pin (graphic accent only) | `#B86B2A` |
| Copper text on light | `#8E4F2A` |
| Copper text on dark | `#D07A32` |
| Page Sand (decorative fill) | `#D8A178` |
| Stone (secondary text) | `#6D675F` |
| Rule (hairlines) | `#D7D0C4` |

Copper is a navigational signal, not a decorative wash: roughly 10–15% of any composition,
reserved for the moment of orientation (active locations, selected filters, primary actions,
evidence markers). Raw Copper Pin never carries body-size text on light canvas. Dark theme is
first-class, not an afterthought.

**Type.** Sora SemiBold headlines; Inter UI/body; Source Serif 4 editorial/longform; IBM Plex Mono
for data, citations, dates, confidence, and technical labels. All open-source; no licensed fonts.

**Shape.** Radii 8/16/28px (sm/md/lg). Flat matte fills only — no bevels, shadows, glows,
gradients, 3D, or ornamental motion, anywhere, ever.

**The mark.** A standalone book-and-pin symbol beside the BlackStory wordmark. Lockup and symbol
are artwork — never reconstruct either by typing the wordmark next to a bare symbol render.
Serve from `apps/web/public/brand/` (masters in root `brand/`).

**Imagery and people.** Place first; evidence visible; people with context — a person is always
identified (PERSON / ROLE / PLACE / YEAR), never anonymous decoration. Avoid generic "Black
history" stock imagery, automatic sepia filters, AI images presented as documentary material,
and maps without source/precision context.

**Map dignity rules.** No red or alarm hues for violence-adjacent records; no crime-heat
rendering; color is never the only signal (confidence stays glyph-encoded); points render no
sharper than stored precision and a coarsened point is never labeled as an exact address.

**File naming.** Lowercase-kebab file names everywhere, including docs and asset packs —
no uppercase file names in new work.

## UI Design Patterns

**Index:** [`docs/ui/README.md`](docs/ui/README.md) — living pattern catalog and adoption checklists.  
**Component registry:** [`docs/ui/patterns-registry.md`](docs/ui/patterns-registry.md) — reusable modules under `apps/web/src/components/patterns/`.

### Binding docs (read before UI edits)

| Doc | Scope |
|---|---|
| [`docs/ui/PROTECTED-EXPERIENCES.md`](docs/ui/PROTECTED-EXPERIENCES.md) | Memorial + evidence/precision/dignity/public/brand laws |
| [`docs/ui/design-direction-v10.md`](docs/ui/design-direction-v10.md) | Product thesis, visual models, surface law, authority order |
| [`docs/ui/brand.md`](docs/ui/brand.md) | Palette, type, mark, copper discipline |
| [`docs/ui/v10/`](docs/ui/v10/) | Inventory, DiscoveryState, Place anatomy, research, cost, reconciliation |
| [`docs/ui/design-direction-v6-mobile.md`](docs/ui/design-direction-v6-mobile.md) | `@repo/mobile` tab bar, More menu, shell chrome (until v10 mobile packet) |
| [`docs/ui/patterns-*.md`](docs/ui/) | Reusable site patterns (map encoding, record anatomy, …) |
| [`docs/ui/story.md`](docs/ui/story.md) | Voice, microcopy, narrative arc |

v6/v9 surface direction docs are archival or superseded — see [`docs/ui/v10/design-doc-reconciliation.md`](docs/ui/v10/design-doc-reconciliation.md). Do not restore Instrument chrome on `/` from v9 Atlas docs.

Kit implementation: `@repo/ui` (`packages/ui`). Where a pattern doc and the kit disagree on tokens, **the kit wins**; where layout/behavior is specified, **the pattern doc wins**.

### Rules for agents shipping UI

1. **Never invent one-off visual language.** Extend an existing pattern component or update/create the matching `docs/ui/patterns-*.md` in the **same PR/change** as the code.
2. **Check both themes** (`data-theme` light + dark) before calling UI done. Dark is first-class, not an afterthought.
3. **Copper discipline:** ~10–15% of composition; navigational signal only (active filters, primary CTA, evidence markers). Raw Copper Pin never carries body-size text on light canvas.
4. **Flat matte only:** no bevels, shadows, glows, gradients, 3D, or ornamental motion.
5. **Contrast:** WCAG 2.2 AA minimum; verify focus rings and `:focus-visible` on new controls.
6. **Copy:** no em dashes in user-facing strings on touched surfaces.
7. **Map dignity:** no alarm hues for violence-adjacent records; confidence never color-alone; points never sharper than stored precision.
8. **File naming:** lowercase-kebab for new docs, CSS, and components.

When adding a reusable control, prefer `apps/web/src/components/patterns/` + a pattern doc + a row in `patterns-registry.md`. Surface-specific layout stays in route folders (`app/`, `components/home/`, etc.) but must cite its binding direction doc.

## Cursor Cloud specific instructions

Notes for Cloud Agents running in this VM. The startup update script already runs `pnpm install --frozen-lockfile` + `uv sync --all-packages --frozen`; toolchains (`node`, `pnpm`, `uv`) are on PATH via the agent's `~/.bashrc`. Standard commands live in `README.md` and root `package.json` scripts; only the non-obvious caveats are here.

### Node version gotcha (load-bearing)
The base image ships an older `/exec-daemon/node` (v22.14.0) that lacks `module.registerHooks`, which `apps/web` tests require (`test/css-stub.mjs`). `~/.bashrc` prepends nvm's default Node 22 (currently v22.22.2, satisfies `.nvmrc`'s `22` and `>=22.15`) ahead of it, so interactive shells get the right node. If a shell ever resolves `node -v` to 22.14.0 (e.g. a non-login shell), fix PATH with:
`export PATH="$(dirname "$(nvm which default)"):$PATH"` (after sourcing nvm).

### Running the web app without a database
- `PUBLIC_DATA_SOURCE=seed DEV_NO_ADMIN=1 pnpm dev:web` starts `@repo/web` alone on port 3048 (`DEV_NO_ADMIN=1` skips the admin console, which needs a Supabase project).
- The live catalog/map pages (`/`, `/explore`, `/records`, `/memorial`, `/themes`) require live Postgres (`PUBLIC_DATA_SOURCE=postgres` + `DATABASE_URL` + `DATABASE_SSL=1`). Without a DB they return HTTP 500: `apps/web/src/lib/public-data/source.ts` has no seed fallback, despite older README/`public-seed.ts` comments implying a "Dunbar seed" home page.
- Editorial/utility pages render fine with no DB: `/about`, `/methodology`, `/stories`, `/data`, `/books`, `/law`, `/support`, `/privacy`, `/errata`, `/design-system`, `/corrections`, `/submit`, `/locate`.

### Corrections/submit intake in dev
`/corrections` and `/submit` use an in-memory store (`apps/web/src/app/corrections/store.ts`), so a submission succeeds and returns a receipt code with no DB. The `/corrections/status/<receipt>` lookup will report "Receipt not found" in dev because the in-memory store is not shared across route handlers/process boundaries (production persists via the `submissionInbox` backing). This is expected locally, not a bug.

### Optional services (not needed for core web dev)
Docker is not installed, so the parked local PostGIS (`pnpm db:up`) does not run here; it is optional per ADR-011. Firebase emulators need a Java runtime and are optional. `apps/mobile` (Expo iOS) cannot run on this Linux VM (requires macOS/Xcode) and is excluded from the pnpm workspace (its own `package-lock.json`).

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
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
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
